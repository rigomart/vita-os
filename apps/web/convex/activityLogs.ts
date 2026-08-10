import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { getOwned, requireOwned } from "./lib/ownedAccess";

export const listByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];

    const thread = await getOwned(ctx, "threads", {
      userId,
      id: args.threadId,
    });
    if (!thread) return [];

    return ctx.db
      .query("activityLogs")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .collect();
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

    return ctx.db.insert("activityLogs", {
      userId,
      threadId: args.threadId,
      type: "note",
      content: args.content,
      createdAt: Date.now(),
    });
  },
});
