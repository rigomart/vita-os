import { paginationOptsValidator } from "convex/server";

import { internalMutation } from "./_generated/server";
import { DEFAULT_AREA_ICON } from "./lib/areaIcons";

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

/**
 * Give every Area an `icon`, so the field can stop being optional. Run
 * manually from the Convex dashboard, paged like `backfillThreadLastActivity`.
 *
 * REQUIRED before deploying the schema that makes `areas.icon` required:
 * that deploy validates every existing document, and an Area without an icon
 * fails it.
 *
 * Areas created before the field existed get `Compass` — the same icon the
 * UI already substituted for a missing one, so nothing on screen changes.
 * Areas that already carry an icon are skipped, making the migration safe to
 * re-run.
 */
export const backfillAreaIcons = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("areas").paginate(args.paginationOpts);

    for (const area of page.page) {
      if (area.icon !== undefined) continue;

      await ctx.db.patch(area._id, { icon: DEFAULT_AREA_ICON });
    }

    return { isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** The Activity Log entry types the app still writes. */
const LIVE_ACTIVITY_LOG_ENTRY_TYPES = new Set<string>([
  "note",
  "area_move",
  "next_action_change",
  "state_change",
  "follow_up_change",
]);

/**
 * Retype the Activity Log entries left behind by retired entry kinds, so the
 * type union can shrink to what the app actually writes.
 *
 * Retyping is lossless — `content`/`previousValue`/`newValue` are untouched,
 * only the icon changes. `status_change` becomes `state_change`; the rest
 * become notes.
 *
 * REQUIRED before deploying the schema that prunes the type union, alongside
 * `backfillAreaIcons`: that deploy validates every existing document, and an
 * entry with a retired type fails it. Entries already in the live set are
 * skipped, making the migration safe to re-run.
 *
 * WARNING for future re-runs: `LIVE_ACTIVITY_LOG_ENTRY_TYPES` is a snapshot,
 * deliberately not derived from `activityLogEntryTypeValidator` (this file
 * must compile against the pre-prune schema). If a new entry kind is ever
 * added to the union, add it to the Set BEFORE re-running, or the re-run
 * rewrites every row of the new kind to `note` — or better, delete both
 * one-shots once they have run against the deployment.
 */
export const migrateLegacyActivityLogTypes = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("activityLogs")
      .paginate(args.paginationOpts);

    for (const entry of page.page) {
      // Widened to `string` on purpose. This runs against the old schema,
      // whose union still holds the retired names, but has to compile against
      // the new one, whose union does not — comparing the field to a name the
      // union has dropped is a type error, not a false comparison.
      const type: string = entry.type;
      if (LIVE_ACTIVITY_LOG_ENTRY_TYPES.has(type)) continue;

      await ctx.db.patch(entry._id, {
        type: type === "status_change" ? "state_change" : "note",
      });
    }

    return { isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/**
 * Move hand-written Activity Log notes into the Thread Note table.
 *
 * The source row is deleted only after its replacement is inserted, so a
 * failed page cannot lose prose. Re-running is safe because successful rows
 * are no longer present in the source query. Creation time becomes both the
 * Note's creation and initial edit time; every later edit advances updatedAt.
 */
export const migrateActivityLogNotesToThreadNotes = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("activityLogs")
      .filter((q) => q.eq(q.field("type"), "note"))
      .paginate(args.paginationOpts);

    for (const entry of page.page) {
      await ctx.db.insert("threadNotes", {
        userId: entry.userId,
        threadId: entry.threadId,
        body: entry.content,
        updatedAt: entry.createdAt,
        state: "open",
        createdAt: entry.createdAt,
      });
      await ctx.db.delete(entry._id);
    }

    return { isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
