import { paginationOptsValidator } from "convex/server";

import { internalMutation } from "./_generated/server";

/**
 * Stamp `lastActivityAt`/`lastActivityContent` onto Threads created before
 * the fields existed. Run manually from the Convex dashboard, passing pages
 * of e.g. `{ "paginationOpts": { "numItems": 100, "cursor": null } }` and
 * feeding `continueCursor` back until `isDone`. REQUIRED after deploy:
 * until it has run, pre-existing Threads show no recent activity.
 *
 * Threads that already carry a stamp are skipped, so the migration is safe
 * to re-run and never overwrites what `recordActivity` wrote in the meantime.
 */
export const backfillThreadLastActivity = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("threads").paginate(args.paginationOpts);

    for (const thread of page.page) {
      if (thread.lastActivityAt !== undefined) continue;

      const newest = await ctx.db
        .query("activityLogs")
        .withIndex("by_user_thread", (q) =>
          q.eq("userId", thread.userId).eq("threadId", thread._id),
        )
        .order("desc")
        .first();
      if (!newest) continue;

      await ctx.db.patch(thread._id, {
        lastActivityAt: newest.createdAt,
        lastActivityContent: newest.content,
      });
    }

    return { isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
