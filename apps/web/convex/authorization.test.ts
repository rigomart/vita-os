import { beforeEach, describe, expect, it } from "vitest";

import type { Fixture, SignedIn, TestApi } from "./test.helpers";

import { api } from "./_generated/api";
import { FIRST_PAGE, seed, setupTest, signIn } from "./test.helpers";

/**
 * Authorization tests for every public Convex function, exercised through
 * `api.*` exactly as a client would. Sign-in and fixtures come from
 * `test.helpers`, which stands up a real Better Auth session.
 */

describe("owned-document authorization", () => {
  let t: TestApi;
  let owner: SignedIn;
  let intruder: SignedIn;
  let owned: Fixture;

  beforeEach(async () => {
    t = setupTest();
    owner = await signIn(t, "owner@example.com");
    intruder = await signIn(t, "intruder@example.com");
    owned = await seed(owner);
  });

  describe("areas", () => {
    it("hides another user's Area from every read", async () => {
      // Assert the owner's side first: an isolation check alone would pass
      // against a function that returned nothing to anybody.
      expect(
        (await owner.query(api.areas.list, {})).map((area) => area._id),
      ).toEqual([owned.areaId]);
      expect(await owner.query(api.areas.get, { id: owned.areaId })).toEqual(
        expect.objectContaining({ _id: owned.areaId }),
      );
      expect(
        await owner.query(api.areas.getBySlug, { slug: owned.areaSlug }),
      ).toEqual(expect.objectContaining({ _id: owned.areaId }));

      expect(await intruder.query(api.areas.list, {})).toEqual([]);
      expect(await intruder.query(api.areas.get, { id: owned.areaId })).toBe(
        null,
      );
      expect(
        await intruder.query(api.areas.getBySlug, { slug: owned.areaSlug }),
      ).toBe(null);
    });

    it("refuses another user's Area in every mutation", async () => {
      await expect(
        intruder.mutation(api.areas.update, {
          id: owned.areaId,
          name: "Stolen",
        }),
      ).rejects.toThrow(/Area not found/);
      await expect(
        intruder.mutation(api.areas.remove, { id: owned.areaId }),
      ).rejects.toThrow(/Area not found/);

      expect(await owner.query(api.areas.get, { id: owned.areaId })).toEqual(
        expect.objectContaining({ name: "Family Health" }),
      );
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.areas.create, {
          name: "Anon",
          condition: "healthy",
          icon: "HeartPulse",
        }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.areas.update, { id: owned.areaId, name: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.areas.remove, { id: owned.areaId }),
      ).rejects.toThrow();
    });
  });

  describe("threads", () => {
    it("hides another user's Thread from every read", async () => {
      expect(
        (await owner.query(api.threads.list, {})).map((thread) => thread._id),
      ).toEqual([owned.threadId]);
      expect(
        await owner.query(api.threads.get, { id: owned.threadId }),
      ).toEqual(expect.objectContaining({ _id: owned.threadId }));
      expect(
        await owner.query(api.threads.getBySlug, { slug: owned.threadSlug }),
      ).toEqual(expect.objectContaining({ _id: owned.threadId }));
      expect(
        (
          await owner.query(api.threads.listByArea, { areaId: owned.areaId })
        ).map((thread) => thread._id),
      ).toEqual([owned.threadId]);

      expect(await intruder.query(api.threads.list, {})).toEqual([]);
      expect(
        await intruder.query(api.threads.get, { id: owned.threadId }),
      ).toBe(null);
      expect(
        await intruder.query(api.threads.getBySlug, { slug: owned.threadSlug }),
      ).toBe(null);
      expect(
        await intruder.query(api.threads.listByArea, { areaId: owned.areaId }),
      ).toEqual([]);
    });

    it("refuses another user's Thread in every mutation", async () => {
      await expect(
        intruder.mutation(api.threads.update, {
          id: owned.threadId,
          title: "Stolen",
        }),
      ).rejects.toThrow(/Thread not found/);
      await expect(
        intruder.mutation(api.threads.remove, { id: owned.threadId }),
      ).rejects.toThrow(/Thread not found/);
      await expect(
        intruder.mutation(api.threads.completeNextMoveMutation, {
          id: owned.threadId,
        }),
      ).rejects.toThrow(/Thread not found/);
    });

    it("refuses filing a Thread under another user's Area", async () => {
      await expect(
        intruder.mutation(api.threads.create, {
          title: "Squatting",
          areaId: owned.areaId,
        }),
      ).rejects.toThrow(/Area not found/);
    });

    it("refuses moving one's own Thread into another user's Area", async () => {
      const theirs = await seed(intruder);

      await expect(
        intruder.mutation(api.threads.update, {
          id: theirs.threadId,
          areaId: owned.areaId,
        }),
      ).rejects.toThrow(/Area not found/);
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.threads.create, {
          title: "Anon",
          areaId: owned.areaId,
        }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.threads.update, { id: owned.threadId, title: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.threads.remove, { id: owned.threadId }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.threads.completeNextMoveMutation, {
          id: owned.threadId,
        }),
      ).rejects.toThrow();
    });
  });

  describe("tasks", () => {
    it("hides another user's Task from every read", async () => {
      await owner.mutation(api.tasks.markDone, { id: owned.taskId });

      expect(
        (
          await owner.query(api.tasks.listDone, {
            paginationOpts: FIRST_PAGE,
          })
        ).page.map((task) => task._id),
      ).toEqual([owned.taskId]);

      expect(
        (
          await intruder.query(api.tasks.listDone, {
            paginationOpts: FIRST_PAGE,
          })
        ).page,
      ).toEqual([]);

      await owner.mutation(api.tasks.markOpen, { id: owned.taskId });

      expect(
        (await owner.query(api.tasks.list, {})).map((task) => task._id),
      ).toEqual([owned.taskId]);
      expect(await owner.query(api.tasks.count, {})).toBe(1);

      expect(await intruder.query(api.tasks.list, {})).toEqual([]);
      expect(await intruder.query(api.tasks.count, {})).toBe(0);
    });

    it("refuses another user's Task in every mutation", async () => {
      await expect(
        intruder.mutation(api.tasks.remove, { id: owned.taskId }),
      ).rejects.toThrow(/Task not found/);
      await expect(
        intruder.mutation(api.tasks.updateText, {
          id: owned.taskId,
          text: "Stolen",
        }),
      ).rejects.toThrow(/Task not found/);
      await expect(
        intruder.mutation(api.tasks.updateWhen, {
          id: owned.taskId,
          when: Date.now(),
        }),
      ).rejects.toThrow(/Task not found/);
      await expect(
        intruder.mutation(api.tasks.markDone, { id: owned.taskId }),
      ).rejects.toThrow(/Task not found/);
      await expect(
        intruder.mutation(api.tasks.markOpen, { id: owned.taskId }),
      ).rejects.toThrow(/Task not found/);
      await expect(
        intruder.mutation(api.tasks.process, {
          id: owned.taskId,
          action: { type: "discard" },
        }),
      ).rejects.toThrow(/Task not found/);

      expect(await owner.query(api.tasks.count, {})).toBe(1);
    });

    it("refuses processing one's own Task into another user's Thread", async () => {
      const theirs = await seed(intruder);

      await expect(
        intruder.mutation(api.tasks.process, {
          id: theirs.taskId,
          action: {
            type: "add_activity_log_entry",
            threadId: owned.threadId,
          },
        }),
      ).rejects.toThrow(/Thread not found/);
      await expect(
        intruder.mutation(api.tasks.process, {
          id: theirs.taskId,
          action: { type: "set_next_move", threadId: owned.threadId },
        }),
      ).rejects.toThrow(/Thread not found/);
      await expect(
        intruder.mutation(api.tasks.process, {
          id: theirs.taskId,
          action: {
            type: "create_thread",
            title: "Squatting",
            areaId: owned.areaId,
          },
        }),
      ).rejects.toThrow(/Area not found/);
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.tasks.create, { text: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.tasks.remove, { id: owned.taskId }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.tasks.updateText, { id: owned.taskId, text: "Anon" }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.tasks.markDone, { id: owned.taskId }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.tasks.process, {
          id: owned.taskId,
          action: { type: "discard" },
        }),
      ).rejects.toThrow();
    });
  });

  describe("activityLogs", () => {
    it("hides another user's Activity Log from every read", async () => {
      expect(
        (
          await owner.query(api.activityLogs.listByThread, {
            threadId: owned.threadId,
            paginationOpts: FIRST_PAGE,
          })
        ).page.map((log) => log._id),
      ).toContain(owned.logId);

      expect(
        (
          await intruder.query(api.activityLogs.listByThread, {
            threadId: owned.threadId,
            paginationOpts: FIRST_PAGE,
          })
        ).page,
      ).toEqual([]);
    });

    it("refuses writing to another user's Thread", async () => {
      await expect(
        intruder.mutation(api.activityLogs.create, {
          threadId: owned.threadId,
          content: "Injected",
        }),
      ).rejects.toThrow(/Thread not found/);

      const logs = await owner.query(api.activityLogs.listByThread, {
        threadId: owned.threadId,
        paginationOpts: FIRST_PAGE,
      });
      expect(logs.page.map((log) => log._id)).toContain(owned.logId);
      expect(logs.page.map((log) => log.content)).not.toContain("Injected");
    });

    it("refuses unauthenticated mutations", async () => {
      await expect(
        t.mutation(api.activityLogs.create, {
          threadId: owned.threadId,
          content: "Anon",
        }),
      ).rejects.toThrow();
    });
  });

  describe("dashboard", () => {
    it("shows another user nothing of the owner's data", async () => {
      const mine = await owner.query(api.dashboard.overview, {
        currentDate: Date.now(),
        timezoneOffsetMinutes: 0,
      });
      expect(mine.areas.map((area) => area.id)).toEqual([owned.areaId]);
      expect(mine.threads.map((thread) => thread.id)).toEqual([owned.threadId]);
      expect(mine.inbox.items.map((item) => item.id)).toEqual([owned.taskId]);
      expect(mine.recentActivity.map((entry) => entry.id)).toContain(
        owned.logId,
      );

      const overview = await intruder.query(api.dashboard.overview, {
        currentDate: Date.now(),
        timezoneOffsetMinutes: 0,
      });

      expect(overview).toEqual({
        areas: [],
        threads: [],
        inbox: { items: [], totalOpen: 0 },
        recentActivity: [],
      });
    });

    it("shows an unauthenticated caller nothing", async () => {
      const overview = await t.query(api.dashboard.overview, {
        currentDate: Date.now(),
        timezoneOffsetMinutes: 0,
      });

      expect(overview.areas).toEqual([]);
      expect(overview.threads).toEqual([]);
    });
  });

  describe("duplicate slugs", () => {
    it("resolves an Area slug shared by two documents to the oldest", async () => {
      const ids = await t.run(async (ctx) => {
        const base = {
          userId: (await ctx.db.get("areas", owned.areaId))?.userId ?? "",
          slug: "shared-slug",
          condition: "healthy" as const,
          createdAt: 0,
        };
        const first = await ctx.db.insert("areas", {
          ...base,
          name: "First",
          order: 10,
        });
        const second = await ctx.db.insert("areas", {
          ...base,
          name: "Second",
          order: 11,
        });
        return { first, second };
      });

      const found = await owner.query(api.areas.getBySlug, {
        slug: "shared-slug",
      });
      expect(found?._id).toBe(ids.first);
    });

    it("resolves a Thread slug shared by two documents to the oldest", async () => {
      const ids = await t.run(async (ctx) => {
        const base = {
          userId: (await ctx.db.get("threads", owned.threadId))?.userId ?? "",
          slug: "shared-slug",
          areaId: owned.areaId,
          state: "open" as const,
          createdAt: 0,
        };
        const first = await ctx.db.insert("threads", {
          ...base,
          title: "First",
          order: 10,
        });
        const second = await ctx.db.insert("threads", {
          ...base,
          title: "Second",
          order: 11,
        });
        return { first, second };
      });

      const found = await owner.query(api.threads.getBySlug, {
        slug: "shared-slug",
      });
      expect(found?._id).toBe(ids.first);
    });
  });
});
