import type { Infer } from "convex/values";

import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { areaIconValidator, conditionValidator } from "./lib/validators";
import schema from "./schema";
import { setupTest, signIn } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

/**
 * The pre-tightening schema. A migration's whole purpose is documents the
 * current schema rejects, so its fixtures cannot be seeded under it; only the
 * loosened tables are restated, the rest come from the real schema.
 */
const legacyActivityLogEntryTypeValidator = v.union(
  v.literal("note"),
  v.literal("status_change"),
  v.literal("next_action_change"),
  v.literal("state_change"),
  v.literal("decision"),
  v.literal("reference"),
  v.literal("waiting_change"),
  v.literal("follow_up_change"),
  v.literal("area_move"),
);

type LegacyActivityLogEntryType = Infer<
  typeof legacyActivityLogEntryTypeValidator
>;

const legacySchema = defineSchema({
  ...schema.tables,
  areas: defineTable({
    userId: v.string(),
    name: v.string(),
    slug: v.string(),
    standard: v.optional(v.string()),
    condition: conditionValidator,
    icon: v.optional(areaIconValidator),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_order", ["userId", "order"])
    .index("by_user_slug", ["userId", "slug"]),
  activityLogs: defineTable({
    userId: v.string(),
    threadId: v.id("threads"),
    type: legacyActivityLogEntryTypeValidator,
    content: v.string(),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_thread", ["userId", "threadId", "createdAt"]),
});

function setupLegacyTest() {
  return convexTest(legacySchema, modules);
}

/** Drive a paginated migration to completion, returning the page count. */
async function runToCompletion(
  runPage: (paginationOpts: {
    numItems: number;
    cursor: string | null;
  }) => Promise<{ isDone: boolean; continueCursor: string }>,
): Promise<number> {
  let cursor: string | null = null;
  let pages = 0;

  for (;;) {
    const page = await runPage({ numItems: 1, cursor });
    pages += 1;
    if (page.isDone) return pages;
    cursor = page.continueCursor;
    expect(pages).toBeLessThan(10);
  }
}

describe("migrations.backfillThreadLastActivity", () => {
  it("stamps the newest entry, skipping empty and already-stamped Threads", async () => {
    const t = setupTest();
    const owner = await signIn(t, "owner@example.com");
    const area = await owner.mutation(api.areas.create, {
      name: "Family Health",
      condition: "healthy",
      icon: "HeartPulse",
    });
    const withLogs = await owner.mutation(api.threads.create, {
      title: "With logs",
      areaId: area.id,
    });
    const empty = await owner.mutation(api.threads.create, {
      title: "Empty",
      areaId: area.id,
    });
    const stamped = await owner.mutation(api.threads.create, {
      title: "Stamped",
      areaId: area.id,
    });

    // Raw inserts, not activityLogs.create: pre-migration rows exist without
    // a denormalized stamp on their Thread. Out-of-order createdAt pins that
    // the migration reads the index newest-first, not insertion order.
    await t.run(async (ctx) => {
      const thread = await ctx.db.get("threads", withLogs.id);
      const userId = thread?.userId ?? "";
      for (const entry of [
        { content: "oldest", createdAt: 10 },
        { content: "newest", createdAt: 30 },
        { content: "middle", createdAt: 20 },
      ]) {
        await ctx.db.insert("activityLogs", {
          userId,
          threadId: withLogs.id,
          type: "note",
          ...entry,
        });
      }
      await ctx.db.insert("activityLogs", {
        userId,
        threadId: stamped.id,
        type: "note",
        content: "ignored",
        createdAt: 50,
      });
      await ctx.db.patch("threads", stamped.id, {
        lastActivityAt: 999,
        lastActivityContent: "sentinel",
      });
    });

    let cursor: string | null = null;
    let pages = 0;
    for (;;) {
      const page: { isDone: boolean; continueCursor: string } =
        await t.mutation(internal.migrations.backfillThreadLastActivity, {
          paginationOpts: { numItems: 1, cursor },
        });
      pages += 1;
      if (page.isDone) break;
      cursor = page.continueCursor;
      expect(pages).toBeLessThan(10);
    }
    expect(pages).toBeGreaterThan(1);

    const [backfilled, untouched, sentinel] = await t.run((ctx) =>
      Promise.all([
        ctx.db.get("threads", withLogs.id),
        ctx.db.get("threads", empty.id),
        ctx.db.get("threads", stamped.id),
      ]),
    );
    expect(backfilled?.lastActivityAt).toBe(30);
    expect(backfilled?.lastActivityContent).toBe("newest");
    expect(untouched?.lastActivityAt).toBeUndefined();
    expect(untouched?.lastActivityContent).toBeUndefined();
    expect(sentinel?.lastActivityAt).toBe(999);
    expect(sentinel?.lastActivityContent).toBe("sentinel");
  });
});

describe("migrations.backfillAreaIcons", () => {
  it("gives icon-less Areas the default, leaving chosen icons alone", async () => {
    const t = setupLegacyTest();

    const ids = await t.run(async (ctx) => {
      const base = {
        userId: "user-1",
        condition: "healthy" as const,
        createdAt: 0,
      };
      // No `icon`: exactly the shape of an Area created before the field
      // existed, which the tightened schema no longer accepts.
      const legacy = await ctx.db.insert("areas", {
        ...base,
        name: "Family Health",
        slug: "family-health",
        order: 0,
      });
      const chosen = await ctx.db.insert("areas", {
        ...base,
        name: "Fitness",
        slug: "fitness",
        order: 1,
        icon: "Dumbbell" as const,
      });
      // Another user's Area is backfilled too: the migration sweeps the table,
      // not one owner's slice.
      const theirs = await ctx.db.insert("areas", {
        ...base,
        userId: "user-2",
        name: "Work",
        slug: "work",
        order: 0,
      });
      return { legacy, chosen, theirs };
    });

    const pages = await runToCompletion((paginationOpts) =>
      t.mutation(internal.migrations.backfillAreaIcons, { paginationOpts }),
    );
    expect(pages).toBeGreaterThan(1);

    const [legacy, chosen, theirs] = await t.run((ctx) =>
      Promise.all([
        ctx.db.get("areas", ids.legacy),
        ctx.db.get("areas", ids.chosen),
        ctx.db.get("areas", ids.theirs),
      ]),
    );
    expect(legacy?.icon).toBe("Compass");
    expect(theirs?.icon).toBe("Compass");
    expect(chosen?.icon).toBe("Dumbbell");
  });

  it("is safe to re-run", async () => {
    const t = setupLegacyTest();

    const id = await t.run((ctx) =>
      ctx.db.insert("areas", {
        userId: "user-1",
        name: "Family Health",
        slug: "family-health",
        condition: "healthy" as const,
        order: 0,
        createdAt: 0,
      }),
    );

    const run = () =>
      runToCompletion((paginationOpts) =>
        t.mutation(internal.migrations.backfillAreaIcons, { paginationOpts }),
      );
    await run();
    // A second pass must not overwrite an icon the user picked in between.
    await t.run((ctx) => ctx.db.patch("areas", id, { icon: "Plane" }));
    await run();

    expect((await t.run((ctx) => ctx.db.get("areas", id)))?.icon).toBe("Plane");
  });
});

describe("migrations.migrateLegacyActivityLogTypes", () => {
  /** One Thread to hang Activity Log entries off, seeded under the old schema. */
  async function seedThread(t: ReturnType<typeof setupLegacyTest>) {
    return t.run(async (ctx) => {
      const areaId = await ctx.db.insert("areas", {
        userId: "user-1",
        name: "Family Health",
        slug: "family-health",
        condition: "healthy" as const,
        icon: "HeartPulse" as const,
        order: 0,
        createdAt: 0,
      });
      return ctx.db.insert("threads", {
        userId: "user-1",
        title: "Book checkup",
        slug: "book-checkup",
        areaId,
        order: 0,
        state: "open" as const,
        createdAt: 0,
      });
    });
  }

  it("retypes every retired kind and leaves the live ones alone", async () => {
    const t = setupLegacyTest();
    const threadId = await seedThread(t);

    const ids = await t.run(async (ctx) => {
      const insert = (
        type: LegacyActivityLogEntryType,
        content: string,
        createdAt: number,
      ) =>
        ctx.db.insert("activityLogs", {
          userId: "user-1",
          threadId,
          type,
          content,
          previousValue: "before",
          newValue: "after",
          createdAt,
        });

      return {
        status: await insert("status_change", "Legacy status preserved", 10),
        reference: await insert("reference", "Legacy target date", 20),
        waiting: await insert("waiting_change", "Legacy waiting context", 30),
        decision: await insert("decision", "Legacy decision", 40),
        note: await insert("note", "Left a voicemail", 50),
        stateChange: await insert("state_change", "Resolved thread", 60),
      };
    });

    const pages = await runToCompletion((paginationOpts) =>
      t.mutation(internal.migrations.migrateLegacyActivityLogTypes, {
        paginationOpts,
      }),
    );
    expect(pages).toBeGreaterThan(1);

    const [status, reference, waiting, decision, note, stateChange] =
      await t.run((ctx) =>
        Promise.all([
          ctx.db.get("activityLogs", ids.status),
          ctx.db.get("activityLogs", ids.reference),
          ctx.db.get("activityLogs", ids.waiting),
          ctx.db.get("activityLogs", ids.decision),
          ctx.db.get("activityLogs", ids.note),
          ctx.db.get("activityLogs", ids.stateChange),
        ]),
      );

    // `status_change` recorded a Thread's health moving; `state_change` is the
    // nearest thing still modeled.
    expect(status?.type).toBe("state_change");
    expect(reference?.type).toBe("note");
    expect(waiting?.type).toBe("note");
    expect(decision?.type).toBe("note");

    expect(note?.type).toBe("note");
    expect(stateChange?.type).toBe("state_change");

    // Retyping is lossless: the prose the reader actually sees is untouched.
    expect(status?.content).toBe("Legacy status preserved");
    expect(status?.previousValue).toBe("before");
    expect(status?.newValue).toBe("after");
    expect(reference?.content).toBe("Legacy target date");
  });

  it("leaves a table of live entries entirely untouched", async () => {
    const t = setupLegacyTest();
    const threadId = await seedThread(t);

    const before = await t.run(async (ctx) => {
      const live: LegacyActivityLogEntryType[] = [
        "note",
        "area_move",
        "next_action_change",
        "state_change",
        "follow_up_change",
      ];
      for (const type of live) {
        await ctx.db.insert("activityLogs", {
          userId: "user-1",
          threadId,
          type,
          content: type,
          createdAt: 0,
        });
      }
      return ctx.db.query("activityLogs").collect();
    });

    await runToCompletion((paginationOpts) =>
      t.mutation(internal.migrations.migrateLegacyActivityLogTypes, {
        paginationOpts,
      }),
    );

    expect(
      await t.run((ctx) => ctx.db.query("activityLogs").collect()),
    ).toEqual(before);
  });

  it("is safe to re-run", async () => {
    const t = setupLegacyTest();
    const threadId = await seedThread(t);

    const id = await t.run((ctx) =>
      ctx.db.insert("activityLogs", {
        userId: "user-1",
        threadId,
        type: "reference" satisfies LegacyActivityLogEntryType,
        content: "Legacy target date",
        createdAt: 0,
      }),
    );

    const run = () =>
      runToCompletion((paginationOpts) =>
        t.mutation(internal.migrations.migrateLegacyActivityLogTypes, {
          paginationOpts,
        }),
      );
    await run();
    await run();

    expect((await t.run((ctx) => ctx.db.get("activityLogs", id)))?.type).toBe(
      "note",
    );
  });
});
