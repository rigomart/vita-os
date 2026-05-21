import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";

export const listByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) return [];

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

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    return ctx.db.insert("activityLogs", {
      userId,
      threadId: args.threadId,
      type: "note",
      content: args.content,
      createdAt: Date.now(),
    });
  },
});
