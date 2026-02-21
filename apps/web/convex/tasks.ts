import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { nullsToUndefined } from "./lib/patch";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const userId = String(user._id);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    return tasks.filter((t) => t.projectId === undefined);
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const userId = String(user._id);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) return [];

    return ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const countByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return {};
    const userId = String(user._id);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (!task.isCompleted && task.projectId) {
        counts[task.projectId] = (counts[task.projectId] ?? 0) + 1;
      }
    }
    return counts;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
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
      projectId: args.projectId,
      order: nextOrder,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    isCompleted: v.optional(v.boolean()),
    dueDate: v.optional(v.union(v.number(), v.null())),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found");
    }

    const { id, ...rest } = args;
    await ctx.db.patch(id, nullsToUndefined(rest));
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
