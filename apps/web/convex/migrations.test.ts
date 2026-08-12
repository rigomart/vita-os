import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { setupTest, signIn } from "./test.helpers";

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
      const page = await t.mutation(
        internal.migrations.backfillThreadLastActivity,
        { paginationOpts: { numItems: 1, cursor } },
      );
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
