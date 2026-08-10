import { beforeEach, describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";
import type { SignedIn, TestApi } from "./test.helpers";

import { api } from "./_generated/api";
import { seed, setupTest, signIn } from "./test.helpers";

/**
 * Every list query has to stay bounded by an index rather than by JavaScript
 * run over a full table scan. These tests pin the observable half of that: the
 * documents each query returns, their order, and the pages they come in.
 */

const NO_CURSOR = { numItems: 2, cursor: null };

async function createTask(
  t: TestApi,
  as: SignedIn,
  spec: { text: string; createdAt: number; done?: boolean },
): Promise<Id<"tasks">> {
  const id = await as.mutation(api.tasks.create, { text: spec.text });
  if (spec.done) {
    await as.mutation(api.tasks.markDone, { id });
  }
  // `create` stamps `createdAt` with the clock, which gives ties inside a
  // single test. Restating it makes the expected order explicit.
  await t.run((ctx) =>
    ctx.db.patch("tasks", id, { createdAt: spec.createdAt }),
  );
  return id;
}

async function createLog(
  t: TestApi,
  as: SignedIn,
  spec: { threadId: Id<"threads">; content: string; createdAt: number },
): Promise<Id<"activityLogs">> {
  const id = await as.mutation(api.activityLogs.create, {
    threadId: spec.threadId,
    content: spec.content,
  });
  await t.run((ctx) =>
    ctx.db.patch("activityLogs", id, { createdAt: spec.createdAt }),
  );
  return id;
}

describe("bounded queries", () => {
  let t: TestApi;
  let owner: SignedIn;
  let other: SignedIn;

  beforeEach(async () => {
    t = setupTest();
    owner = await signIn(t, "owner@example.com");
    other = await signIn(t, "other@example.com");
  });

  describe("tasks.list", () => {
    it("returns Open Tasks only, newest first", async () => {
      const old = await createTask(t, owner, { text: "old", createdAt: 100 });
      await createTask(t, owner, { text: "done", createdAt: 200, done: true });
      const recent = await createTask(t, owner, {
        text: "recent",
        createdAt: 300,
      });
      await createTask(t, other, { text: "theirs", createdAt: 250 });

      expect(
        (await owner.query(api.tasks.list, {})).map((task) => task._id),
      ).toEqual([recent, old]);
    });
  });

  describe("tasks.count", () => {
    it("counts Open Tasks only", async () => {
      await createTask(t, owner, { text: "open", createdAt: 100 });
      await createTask(t, owner, { text: "also open", createdAt: 110 });
      await createTask(t, owner, { text: "done", createdAt: 120, done: true });
      await createTask(t, other, { text: "theirs", createdAt: 130 });

      expect(await owner.query(api.tasks.count, {})).toBe(2);
    });
  });

  describe("tasks.listDone", () => {
    it("pages through Done Tasks newest first, without gaps or repeats", async () => {
      const done: Array<Id<"tasks">> = [];
      for (const createdAt of [10, 20, 30, 40, 50]) {
        done.push(
          await createTask(t, owner, {
            text: `done-${createdAt}`,
            createdAt,
            done: true,
          }),
        );
      }
      await createTask(t, owner, { text: "open", createdAt: 60 });
      await createTask(t, other, {
        text: "theirs",
        createdAt: 35,
        done: true,
      });

      const seen: Array<Id<"tasks">> = [];
      let cursor: string | null = null;
      let pages = 0;

      for (;;) {
        const page = await owner.query(api.tasks.listDone, {
          paginationOpts: { numItems: 2, cursor },
        });
        pages += 1;
        seen.push(...page.page.map((task) => task._id));
        if (page.isDone) break;
        cursor = page.continueCursor;
        expect(pages).toBeLessThan(10);
      }

      expect(pages).toBe(3);
      expect(seen).toEqual([...done].reverse());
    });

    it("returns an empty page to an unauthenticated caller", async () => {
      await createTask(t, owner, { text: "done", createdAt: 10, done: true });

      expect(
        await t.query(api.tasks.listDone, { paginationOpts: NO_CURSOR }),
      ).toEqual({
        page: [],
        isDone: true,
        continueCursor: "",
      });
    });
  });

  describe("threads.list", () => {
    it("returns Open Threads only, in manual order", async () => {
      const fixture = await seed(owner);
      const area = fixture.areaId;
      const second = await owner.mutation(api.threads.create, {
        title: "Second",
        areaId: area,
      });
      const resolved = await owner.mutation(api.threads.create, {
        title: "Resolved",
        areaId: area,
      });
      await owner.mutation(api.threads.update, {
        id: resolved.id,
        state: "resolved",
      });

      // Reorder so the manual order disagrees with creation order.
      await t.run((ctx) => ctx.db.patch("threads", second.id, { order: -1 }));

      expect(
        (await owner.query(api.threads.list, {})).map((thread) => thread._id),
      ).toEqual([second.id, fixture.threadId]);
    });
  });

  describe("threads.listByArea", () => {
    it("returns the Area's Open Threads only", async () => {
      const fixture = await seed(owner);
      const otherArea = await owner.mutation(api.areas.create, {
        name: "Work",
        condition: "healthy",
        icon: "HeartPulse",
      });
      await owner.mutation(api.threads.create, {
        title: "Elsewhere",
        areaId: otherArea.id,
      });
      const resolved = await owner.mutation(api.threads.create, {
        title: "Resolved",
        areaId: fixture.areaId,
      });
      await owner.mutation(api.threads.update, {
        id: resolved.id,
        state: "resolved",
      });

      expect(
        (
          await owner.query(api.threads.listByArea, { areaId: fixture.areaId })
        ).map((thread) => thread._id),
      ).toEqual([fixture.threadId]);
    });

    it("returns nothing for another user's Area", async () => {
      const fixture = await seed(owner);

      expect(
        await other.query(api.threads.listByArea, { areaId: fixture.areaId }),
      ).toEqual([]);
    });
  });

  describe("activityLogs.listByThread", () => {
    it("pages through one Thread's entries, newest first", async () => {
      const fixture = await seed(owner);
      const otherThread = await owner.mutation(api.threads.create, {
        title: "Other",
        areaId: fixture.areaId,
      });
      const elsewhere = await createLog(t, owner, {
        threadId: otherThread.id,
        content: "elsewhere",
        createdAt: 45,
      });

      const mine: Array<Id<"activityLogs">> = [];
      for (const createdAt of [10, 20, 30, 40, 50]) {
        mine.push(
          await createLog(t, owner, {
            threadId: fixture.threadId,
            content: `entry-${createdAt}`,
            createdAt,
          }),
        );
      }

      const seen: Array<Id<"activityLogs">> = [];
      let cursor: string | null = null;
      let pages = 0;

      for (;;) {
        const page = await owner.query(api.activityLogs.listByThread, {
          threadId: fixture.threadId,
          paginationOpts: { numItems: 2, cursor },
        });
        pages += 1;
        seen.push(...page.page.map((log) => log._id));
        if (page.isDone) break;
        cursor = page.continueCursor;
        expect(pages).toBeLessThan(10);
      }

      // The seeded Thread already carries a note and the auto entry from its
      // next move, both stamped with the clock and so newer than the entries
      // created here.
      expect(seen.slice(-5)).toEqual([...mine].reverse());
      expect(seen).toHaveLength(7);
      expect(seen).not.toContain(elsewhere);
    });

    it("returns an empty page for another user's Thread", async () => {
      const fixture = await seed(owner);

      expect(
        await other.query(api.activityLogs.listByThread, {
          threadId: fixture.threadId,
          paginationOpts: NO_CURSOR,
        }),
      ).toEqual({ page: [], isDone: true, continueCursor: "" });
    });

    it("returns an empty page to an unauthenticated caller", async () => {
      const fixture = await seed(owner);

      expect(
        await t.query(api.activityLogs.listByThread, {
          threadId: fixture.threadId,
          paginationOpts: NO_CURSOR,
        }),
      ).toEqual({ page: [], isDone: true, continueCursor: "" });
    });
  });

  describe("threads.remove", () => {
    it("deletes the Thread's Activity Log and nothing else", async () => {
      const fixture = await seed(owner);
      const survivor = await owner.mutation(api.threads.create, {
        title: "Survivor",
        areaId: fixture.areaId,
      });
      await createLog(t, owner, {
        threadId: fixture.threadId,
        content: "doomed note",
        createdAt: 10,
      });
      const survivorLog = await createLog(t, owner, {
        threadId: survivor.id,
        content: "kept",
        createdAt: 20,
      });
      const theirs = await seed(other);

      await owner.mutation(api.threads.remove, { id: fixture.threadId });

      const remaining = await t.run((ctx) =>
        ctx.db.query("activityLogs").collect(),
      );
      expect(remaining.every((log) => log.threadId !== fixture.threadId)).toBe(
        true,
      );
      expect(remaining.map((log) => log._id)).toContain(survivorLog);
      expect(remaining.map((log) => log._id)).toContain(theirs.logId);
    });
  });

  describe("areas.remove", () => {
    it("refuses an Area that still holds a Thread", async () => {
      const fixture = await seed(owner);

      await expect(
        owner.mutation(api.areas.remove, { id: fixture.areaId }),
      ).rejects.toThrow(/Cannot delete an area that has threads/);
    });

    it("refuses an Area whose only Thread is resolved", async () => {
      const fixture = await seed(owner);
      await owner.mutation(api.threads.update, {
        id: fixture.threadId,
        state: "resolved",
      });

      await expect(
        owner.mutation(api.areas.remove, { id: fixture.areaId }),
      ).rejects.toThrow(/Cannot delete an area that has threads/);
    });

    it("deletes an Area once its Threads are gone", async () => {
      const fixture = await seed(owner);
      // Another user's Thread in no way blocks this Area: the guard reads a
      // user-scoped index.
      await seed(other);
      await owner.mutation(api.threads.remove, { id: fixture.threadId });

      await owner.mutation(api.areas.remove, { id: fixture.areaId });

      expect(await owner.query(api.areas.get, { id: fixture.areaId })).toBe(
        null,
      );
    });
  });

  describe("dashboard.overview", () => {
    it("shows Open Threads and Tasks with the latest entry per Thread", async () => {
      const fixture = await seed(owner);
      await createTask(t, owner, { text: "done", createdAt: 10, done: true });
      const resolved = await owner.mutation(api.threads.create, {
        title: "Resolved",
        areaId: fixture.areaId,
      });
      await createLog(t, owner, {
        threadId: resolved.id,
        content: "resolved note",
        createdAt: 99,
      });
      await owner.mutation(api.threads.update, {
        id: resolved.id,
        state: "resolved",
      });

      const overview = await owner.query(api.dashboard.overview, {
        currentDate: Date.now(),
        timezoneOffsetMinutes: 0,
      });

      expect(overview.threads.map((thread) => thread.id)).toEqual([
        fixture.threadId,
      ]);
      expect(overview.inbox.items.map((item) => item.id)).toEqual([
        fixture.taskId,
      ]);
      expect(overview.recentActivity.map((entry) => entry.threadId)).toEqual([
        fixture.threadId,
      ]);
    });
  });
});
