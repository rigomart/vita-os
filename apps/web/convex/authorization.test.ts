import type { TestConvex, TestConvexForDataModel } from "convex-test";
import type { DataModelFromSchemaDefinition } from "convex/server";

import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";

import type { Id } from "./_generated/dataModel";

import { api, components } from "./_generated/api";
import schema from "./schema";

/**
 * Authorization tests for every public Convex function, exercised through
 * `api.*` exactly as a client would.
 *
 * Auth is real, not stubbed: the Better Auth component is registered with
 * `@convex-dev/better-auth/test` (its documented `register` helper), and
 * `signIn` seeds a `user` + non-expired `session` through the component's own
 * `adapter.create` mutation. `authComponent.getAuthUser` then resolves the
 * identity the same way it does in production — `ctx.auth.getUserIdentity()`,
 * then a session lookup by `identity.sessionId` and a user lookup by
 * `identity.subject` against the component's tables.
 */

const modules = import.meta.glob("./**/*.ts");

type Schema = typeof schema;
type TestApi = TestConvex<Schema>;
type SignedIn = TestConvexForDataModel<DataModelFromSchemaDefinition<Schema>>;

const HOUR_MS = 60 * 60 * 1000;

function setupTest(): TestApi {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  return t;
}

/**
 * Create a Better Auth user with a live session and return a `t` bound to
 * that identity.
 */
async function signIn(t: TestApi, email: string): Promise<SignedIn> {
  const now = Date.now();

  const user = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: {
          name: email,
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    }),
  );

  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: user._id,
          token: `token-${email}`,
          expiresAt: now + HOUR_MS,
          createdAt: now,
          updatedAt: now,
        },
      },
    }),
  );

  return t.withIdentity({ subject: user._id, sessionId: session._id });
}

interface Fixture {
  areaId: Id<"areas">;
  areaSlug: string;
  logId: Id<"activityLogs">;
  taskId: Id<"tasks">;
  threadId: Id<"threads">;
  threadSlug: string;
}

/** One Area, Thread, Task and Activity Log, all created through `api.*`. */
async function seed(as: SignedIn): Promise<Fixture> {
  const area = await as.mutation(api.areas.create, {
    name: "Family Health",
    condition: "healthy",
    icon: "HeartPulse",
  });
  const thread = await as.mutation(api.threads.create, {
    title: "Book checkup",
    areaId: area.id,
  });
  await as.mutation(api.threads.update, {
    id: thread.id,
    nextMove: "Call the clinic",
  });
  const taskId = await as.mutation(api.tasks.create, { text: "Buy vitamins" });
  const logId = await as.mutation(api.activityLogs.create, {
    threadId: thread.id,
    content: "Left a voicemail",
  });

  return {
    areaId: area.id,
    areaSlug: area.slug,
    threadId: thread.id,
    threadSlug: thread.slug,
    taskId,
    logId,
  };
}

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
          })
        ).map((log) => log._id),
      ).toContain(owned.logId);

      expect(
        await intruder.query(api.activityLogs.listByThread, {
          threadId: owned.threadId,
        }),
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
      });
      expect(logs.map((log) => log._id)).toContain(owned.logId);
      expect(logs.map((log) => log.content)).not.toContain("Injected");
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
