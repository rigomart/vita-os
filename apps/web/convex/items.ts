import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { processInboxItem } from "./lib/inboxProcessing";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db
      .query("items")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return [
      ...all.filter((item) => !item.isCompleted),
      ...all.filter((item) => item.isCompleted),
    ];
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return 0;
    const all = await ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return all.filter((item) => !item.isCompleted && item.date === undefined)
      .length;
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    return ctx.db.insert("items", {
      userId,
      text: args.text,
      date: args.date,
      isCompleted: false,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.delete(args.id);
  },
});

export const updateText = mutation({
  args: { id: v.id("items"), text: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.id, { text: args.text });
  },
});

export const updateDate = mutation({
  args: { id: v.id("items"), date: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.id, { date: args.date });
  },
});

export const complete = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.id, {
      isCompleted: true,
      completedAt: Date.now(),
    });
  },
});

export const uncomplete = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.id, {
      isCompleted: false,
      completedAt: undefined,
    });
  },
});

export const process = mutation({
  args: {
    id: v.id("items"),
    action: v.union(
      v.object({
        type: v.literal("create_project"),
        name: v.string(),
        areaId: v.id("areas"),
        definitionOfDone: v.optional(v.string()),
      }),
      v.object({
        type: v.literal("add_to_project"),
        projectId: v.id("projects"),
      }),
      v.object({
        type: v.literal("set_next_action"),
        projectId: v.id("projects"),
      }),
      v.object({
        type: v.literal("discard"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    return processInboxItem(ctx, { userId, item, action: args.action });
  },
});
