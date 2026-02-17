import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { generateSlug } from "./lib/slugs";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const userId = String(user._id);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    return projects.filter((p) => !p.isArchived);
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== String(user._id)) return null;
    if (project.isArchived) return null;
    return project;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const userId = String(user._id);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug),
      )
      .unique();
    if (!project || project.isArchived) return null;
    return project;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    definitionOfDone: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.endDate !== undefined && args.startDate === undefined) {
      throw new Error("End date requires a start date");
    }
    if (
      args.startDate !== undefined &&
      args.endDate !== undefined &&
      args.endDate < args.startDate
    ) {
      throw new Error("End date must not be before start date");
    }

    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const nextOrder = existing ? existing.order + 1 : 0;
    const slug = generateSlug(args.name);

    const id = await ctx.db.insert("projects", {
      userId,
      name: args.name,
      slug,
      description: args.description,
      definitionOfDone: args.definitionOfDone,
      startDate: args.startDate,
      endDate: args.endDate,
      order: nextOrder,
      isArchived: false,
      createdAt: Date.now(),
    });

    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    clearDescription: v.optional(v.boolean()),
    definitionOfDone: v.optional(v.string()),
    clearDefinitionOfDone: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    clearStartDate: v.optional(v.boolean()),
    endDate: v.optional(v.number()),
    clearEndDate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    // Compute effective dates to validate the resulting state
    let effectiveStartDate = project.startDate;
    if (args.clearStartDate) {
      effectiveStartDate = undefined;
    } else if (args.startDate !== undefined) {
      effectiveStartDate = args.startDate;
    }

    let effectiveEndDate = project.endDate;
    if (args.clearEndDate || args.clearStartDate) {
      effectiveEndDate = undefined;
    } else if (args.endDate !== undefined) {
      effectiveEndDate = args.endDate;
    }

    if (effectiveEndDate !== undefined && effectiveStartDate === undefined) {
      throw new Error("End date requires a start date");
    }
    if (
      effectiveStartDate !== undefined &&
      effectiveEndDate !== undefined &&
      effectiveEndDate < effectiveStartDate
    ) {
      throw new Error("End date must not be before start date");
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) {
      updates.name = args.name;
      updates.slug = generateSlug(args.name);
    }
    if (args.clearDescription) {
      updates.description = undefined;
    } else if (args.description !== undefined) {
      updates.description = args.description;
    }
    if (args.clearDefinitionOfDone) {
      updates.definitionOfDone = undefined;
    } else if (args.definitionOfDone !== undefined) {
      updates.definitionOfDone = args.definitionOfDone;
    }
    if (args.clearStartDate) {
      updates.startDate = undefined;
      updates.endDate = undefined;
    } else if (args.startDate !== undefined) {
      updates.startDate = args.startDate;
    }
    if (args.clearEndDate || args.clearStartDate) {
      updates.endDate = undefined;
    } else if (args.endDate !== undefined) {
      updates.endDate = args.endDate;
    }

    await ctx.db.patch(args.id, updates);

    return { slug: (updates.slug as string) ?? project.slug };
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    // Archive the project
    await ctx.db.patch(args.id, { isArchived: true });

    // Unassign all tasks from this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const task of tasks) {
      await ctx.db.patch(task._id, { projectId: undefined });
    }
  },
});

export const backfillSlugs = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let count = 0;
    for (const project of projects) {
      if (!project.slug) {
        const slug = generateSlug(project.name);
        await ctx.db.patch(project._id, { slug });
        count++;
      }
    }
    return { backfilled: count };
  },
});
