import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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

export const listUpcoming = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const userId = String(user._id);
    const limit = Math.min(args.limit ?? 20, 50);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    const upcoming = tasks
      .filter(
        (t): t is typeof t & { dueDate: number; projectId: Id<"projects"> } =>
          !t.isCompleted &&
          t.dueDate !== undefined &&
          t.projectId !== undefined,
      )
      .sort((a, b) => a.dueDate - b.dueDate)
      .slice(0, limit);

    // Batch-fetch projects
    const projectIds = [...new Set(upcoming.map((t) => t.projectId))];
    const projectResults = await Promise.all(
      projectIds.map((id) => ctx.db.get(id)),
    );
    const projectMap = new Map<string, (typeof projectResults)[number] & {}>();
    for (const p of projectResults) {
      if (p) projectMap.set(p._id, p);
    }

    // Batch-fetch areas
    const areaIds = [...new Set([...projectMap.values()].map((p) => p.areaId))];
    const areaResults = await Promise.all(areaIds.map((id) => ctx.db.get(id)));
    const areaMap = new Map<string, (typeof areaResults)[number] & {}>();
    for (const a of areaResults) {
      if (a) areaMap.set(a._id, a);
    }

    return upcoming.map((t) => {
      const project = projectMap.get(t.projectId);
      const area = project ? areaMap.get(project.areaId) : undefined;
      return {
        ...t,
        projectName: project?.name ?? "Unknown",
        projectSlug: project?.slug ?? "",
        areaName: area?.name ?? "Unknown",
        areaSlug: area?.slug ?? "",
      };
    });
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
