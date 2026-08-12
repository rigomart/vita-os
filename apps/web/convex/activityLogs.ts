import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";

import { mutation, query } from "./_generated/server";
import { recordActivity } from "./lib/activityWrites";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { getOwned, requireOwned } from "./lib/ownedAccess";
import { emptyPage } from "./lib/pagination";

/**
 * One Thread's Activity Log, newest first, one page at a time.
 *
 * A Thread's history only grows, so it is paginated: the caller decides how
 * far back to read instead of the server handing over every entry.
 */
export const listByThread = query({
  args: {
    threadId: v.id("threads"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return emptyPage<Doc<"activityLogs">>();

    const thread = await getOwned(ctx, "threads", {
      userId,
      id: args.threadId,
    });
    if (!thread) return emptyPage<Doc<"activityLogs">>();

    return ctx.db
      .query("activityLogs")
      .withIndex("by_user_thread", (q) =>
        q.eq("userId", userId).eq("threadId", thread._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const create = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "threads", { userId, id: args.threadId });

    return recordActivity(ctx, {
      userId,
      threadId: args.threadId,
      entry: { type: "note", content: args.content },
      createdAt: Date.now(),
    });
  },
});
