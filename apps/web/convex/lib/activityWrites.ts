import type { GenericMutationCtx } from "convex/server";

import type { DataModel, Id } from "../_generated/dataModel";
import type { ActivityLogEntryType } from "./activityLog";

type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * The single way an Activity Log entry is written.
 *
 * Inserting the row and stamping the Thread's denormalized
 * `lastActivityAt`/`lastActivityContent` happen together here, so the
 * Dashboard's recent-activity strip — which reads only the Thread — can never
 * drift from the log itself. Entries are insert-only and die with their
 * Thread, so a stale-high stamp is unreachable.
 */
export async function recordActivity(
  ctx: MutationCtx,
  args: {
    userId: string;
    threadId: Id<"threads">;
    entry: {
      type: ActivityLogEntryType;
      content: string;
      previousValue?: string;
      newValue?: string;
    };
    createdAt: number;
  },
): Promise<Id<"activityLogs">> {
  const id = await ctx.db.insert("activityLogs", {
    userId: args.userId,
    threadId: args.threadId,
    type: args.entry.type,
    content: args.entry.content,
    previousValue: args.entry.previousValue,
    newValue: args.entry.newValue,
    createdAt: args.createdAt,
  });

  await ctx.db.patch(args.threadId, {
    lastActivityAt: args.createdAt,
    lastActivityContent: args.entry.content,
  });

  return id;
}
