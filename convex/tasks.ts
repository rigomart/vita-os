import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

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
    description: v.optional(v.string()),
    clearDescription: v.optional(v.boolean()),
    isCompleted: v.optional(v.boolean()),
    dueDate: v.optional(v.number()),
    clearDueDate: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
    clearProjectId: v.optional(v.boolean()),
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
    if (args.clearProjectId) {
      updates.projectId = undefined;
    } else if (args.projectId !== undefined) {
      updates.projectId = args.projectId;
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
