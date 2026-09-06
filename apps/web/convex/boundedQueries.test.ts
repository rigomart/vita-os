import type { PaginationResult } from "convex/server";

import { beforeEach, describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";
import type { ProjectedActivityLog, ProjectedNote } from "./lib/validators";
import type { SignedIn, TestApi } from "./test.helpers";

import { api } from "./_generated/api";
import { seed, setupTest, signIn } from "./test.helpers";

/**
 * Every list query has to stay bounded by an index rather than by JavaScript
 * run over a full table scan. These tests pin the observable half of that: the
 * documents each query returns, their order, and the pages they come in.
 */

const NO_CURSOR = { numItems: 2, cursor: null };

async function createNote(
  t: TestApi,
  as: SignedIn,
  spec: { body: string; createdAt: number; done?: boolean },
): Promise<Id<"tasks">> {
  const id = await as.mutation(api.notes.create, { body: spec.body });
  if (spec.done) {
    await as.mutation(api.notes.markDone, { id });
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
  // Back-dating the entry has to back-date the Thread's denormalized stamp
  // too, or last-activity assertions would read the real clock.
  await t.run(async (ctx) => {
    await ctx.db.patch("activityLogs", id, { createdAt: spec.createdAt });
    await ctx.db.patch("threads", spec.threadId, {
      lastActivityAt: spec.createdAt,
      lastActivityContent: spec.content,
    });
  });
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

  describe("notes.list", () => {
    it("returns Open Notes only, newest first", async () => {
      const old = await createNote(t, owner, { body: "old", createdAt: 100 });
      await createNote(t, owner, { body: "done", createdAt: 200, done: true });
      const recent = await createNote(t, owner, {
        body: "recent",
        createdAt: 300,
      });
      await createNote(t, other, { body: "theirs", createdAt: 250 });

      expect(
        (await owner.query(api.notes.list, {})).map((note) => note._id),
      ).toEqual([recent, old]);
    });
  });

  describe("notes.count", () => {
    it("counts Open Notes only", async () => {
      await createNote(t, owner, { body: "open", createdAt: 100 });
      await createNote(t, owner, { body: "also open", createdAt: 110 });
      await createNote(t, owner, { body: "done", createdAt: 120, done: true });
      await createNote(t, other, { body: "theirs", createdAt: 130 });

      expect(await owner.query(api.notes.count, {})).toBe(2);
    });
  });

  describe("notes.listDone", () => {
    it("pages through Done Notes newest first, without gaps or repeats", async () => {
      const done: Array<Id<"tasks">> = [];
      for (const createdAt of [10, 20, 30, 40, 50]) {
        done.push(
          await createNote(t, owner, {
            body: `done-${createdAt}`,
            createdAt,
            done: true,
          }),
        );
      }
      await createNote(t, owner, { body: "open", createdAt: 60 });
      await createNote(t, other, {
        body: "theirs",
        createdAt: 35,
        done: true,
      });

      const seen: Array<Id<"tasks">> = [];
      let cursor: string | null = null;
      let pages = 0;

      for (;;) {
        const page: PaginationResult<ProjectedNote> = await owner.query(
          api.notes.listDone,
          { paginationOpts: { numItems: 2, cursor } },
        );
        pages += 1;
        seen.push(...page.page.map((note) => note._id));
        if (page.isDone) break;
        cursor = page.continueCursor;
        expect(pages).toBeLessThan(10);
      }

      expect(pages).toBe(3);
      expect(seen).toEqual([...done].reverse());
    });

    it("returns an empty page to an unauthenticated caller", async () => {
      await createNote(t, owner, { body: "done", createdAt: 10, done: true });

      expect(
        await t.query(api.notes.listDone, { paginationOpts: NO_CURSOR }),
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

  describe("areas.detailBySlug", () => {
    it("returns the Area with its Open Threads only", async () => {
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

      const detail = await owner.query(api.areas.detailBySlug, {
        slug: fixture.areaSlug,
      });
      expect(detail?.area._id).toBe(fixture.areaId);
      expect(detail?.threads.map((thread) => thread._id)).toEqual([
        fixture.threadId,
      ]);
    });

    it("returns null for another user's Area", async () => {
      const fixture = await seed(owner);

      expect(
        await other.query(api.areas.detailBySlug, { slug: fixture.areaSlug }),
      ).toBe(null);
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
        const page: PaginationResult<ProjectedActivityLog> = await owner.query(
          api.activityLogs.listByThread,
          {
            threadId: fixture.threadId,
            paginationOpts: { numItems: 2, cursor },
          },
        );
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

  describe("threads.detailBySlug", () => {
    it("returns the Thread with the Area it is filed under", async () => {
      const fixture = await seed(owner);

      const detail = await owner.query(api.threads.detailBySlug, {
        slug: fixture.threadSlug,
      });
      expect(detail?.thread._id).toBe(fixture.threadId);
      expect(detail?.area?._id).toBe(fixture.areaId);
    });

    it("returns null for another user's Thread", async () => {
      const fixture = await seed(owner);

      expect(
        await other.query(api.threads.detailBySlug, {
          slug: fixture.threadSlug,
        }),
      ).toBe(null);
    });
  });

  describe("thread last activity", () => {
    const threadDoc = (id: Id<"threads">) =>
      t.run((ctx) => ctx.db.get("threads", id));

    it("starts unset on a Thread with no entries", async () => {
      const fixture = await seed(owner);
      const fresh = await owner.mutation(api.threads.create, {
        title: "Quiet",
        areaId: fixture.areaId,
      });

      const thread = await threadDoc(fresh.id);
      expect(thread?.lastActivityAt).toBeUndefined();
      expect(thread?.lastActivityContent).toBeUndefined();
    });

    it("is stamped by activityLogs.create", async () => {
      const fixture = await seed(owner);

      await owner.mutation(api.activityLogs.create, {
        threadId: fixture.threadId,
        content: "Called the clinic back",
      });

      const thread = await threadDoc(fixture.threadId);
      expect(thread?.lastActivityContent).toBe("Called the clinic back");
      expect(thread?.lastActivityAt).toEqual(expect.any(Number));
    });

    it("keeps the last entry when one update writes several", async () => {
      const fixture = await seed(owner);

      // nextMove logs before followUp, so the follow-up entry must win.
      await owner.mutation(api.threads.update, {
        id: fixture.threadId,
        nextMove: "Book the appointment",
        followUp: new Date("2026-05-20").getTime(),
      });

      const thread = await threadDoc(fixture.threadId);
      expect(thread?.lastActivityContent).toBe(
        'Follow-up set to "May 20, 2026"',
      );
    });
  });
});
