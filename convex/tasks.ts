import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const userId = String(user._id);
    return ctx.db
      .query("tasks")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const nextOrder = existing ? existing.order + 1 : 0;

    return ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      isCompleted: false,
      dueDate: args.dueDate,
      order: nextOrder,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    clearDescription: v.optional(v.boolean()),
    isCompleted: v.optional(v.boolean()),
    dueDate: v.optional(v.number()),
    clearDueDate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.isCompleted !== undefined) updates.isCompleted = args.isCompleted;
    if (args.clearDescription) {
      updates.description = undefined;
    } else if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.clearDueDate) {
      updates.dueDate = undefined;
    } else if (args.dueDate !== undefined) {
      updates.dueDate = args.dueDate;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    await ctx.db.delete(args.id);
  },
});
