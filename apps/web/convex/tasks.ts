import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { isOpenTask } from "./lib/attentionOrdering";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { processInboxTask } from "./lib/inboxProcessing";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db
      .query("tasks")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return [
      ...all.filter((task) => task.state === "open"),
      ...all.filter((task) => task.state === "done"),
    ];
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return 0;
    const all = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return all.filter(isOpenTask).length;
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    when: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    return ctx.db.insert("tasks", {
      userId,
      text: args.text,
      when: args.when,
      state: "open",
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    await ctx.db.delete(args.id);
  },
});

export const updateText = mutation({
  args: { id: v.id("tasks"), text: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    await ctx.db.patch(args.id, { text: args.text });
  },
});

export const updateWhen = mutation({
  args: { id: v.id("tasks"), when: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    await ctx.db.patch(args.id, { when: args.when });
  },
});

export const markDone = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    await ctx.db.patch(args.id, {
      state: "done",
      completedAt: Date.now(),
    });
  },
});

export const markOpen = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    await ctx.db.patch(args.id, {
      state: "open",
      completedAt: undefined,
    });
  },
});

export const process = mutation({
  args: {
    id: v.id("tasks"),
    action: v.union(
      v.object({
        type: v.literal("create_thread"),
        title: v.string(),
        areaId: v.id("areas"),
        summary: v.optional(v.string()),
      }),
      v.object({
        type: v.literal("add_activity_log_entry"),
        threadId: v.id("threads"),
      }),
      v.object({
        type: v.literal("set_next_move"),
        threadId: v.id("threads"),
      }),
      v.object({
        type: v.literal("discard"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    return processInboxTask(ctx, { userId, task, action: args.action });
  },
});
