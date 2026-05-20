import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAreaForUser } from "./lib/areaProjects";
import { DEFAULT_HEALTH_STATUS } from "./lib/healthStatus";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { nullsToUndefined } from "./lib/patch";
import { applyProjectPatch, completeNextMove } from "./lib/projectChanges";
import { generateSlug } from "./lib/slugs";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("projects")
      .withIndex("by_user_state", (q) =>
        q.eq("userId", userId).eq("state", "active"),
      )
      .collect();
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) return null;
    if (project.state !== "active") return null;
    return project;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db
      .query("projects")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug),
      )
      .unique();
    if (!project || project.state !== "active") return null;
    return project;
  },
});

export const listByArea = query({
  args: { areaId: v.id("areas") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
      .collect();
    return projects.filter((p) => p.userId === userId && p.state === "active");
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    definitionOfDone: v.optional(v.string()),
    areaId: v.id("areas"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await getAreaForUser(ctx, { userId, areaId: args.areaId });

    const nextOrder = await getNextOrder(ctx, "projects", userId);
    const slug = generateSlug(args.name);

    const id = await ctx.db.insert("projects", {
      userId,
      name: args.name,
      slug,
      definitionOfDone: args.definitionOfDone,
      areaId: args.areaId,
      order: nextOrder,
      state: "active",
      createdAt: Date.now(),
    });

    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    definitionOfDone: v.optional(v.union(v.string(), v.null())),
    areaId: v.optional(v.id("areas")),
    status: v.optional(v.union(v.string(), v.null())),
    nextMove: v.optional(v.union(v.string(), v.null())),
    followUp: v.optional(v.union(v.number(), v.null())),
    state: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("dropped"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const { id, ...rest } = args;

    if (rest.areaId !== undefined) {
      await getAreaForUser(ctx, { userId, areaId: rest.areaId });
    }

    let newSlug: string | undefined;
    if (rest.name && rest.name !== project.name) {
      newSlug = generateSlug(rest.name);
    }

    await applyProjectPatch(ctx, {
      userId,
      project,
      patch: {
        ...nullsToUndefined(rest),
        ...(newSlug && { slug: newSlug }),
      },
    });

    return { slug: newSlug ?? project.slug };
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    await applyProjectPatch(ctx, {
      userId,
      project,
      patch: { state: "dropped" },
    });
  },
});

export const completeNextMoveMutation = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    await completeNextMove(ctx, { userId, project });
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

export const migrateUngrouped = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    const ungrouped = projects.filter((p) => !p.areaId);
    if (ungrouped.length === 0) return { migrated: 0 };

    // Find or create a "General" area
    const existingAreas = await ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    let generalArea = existingAreas.find((a) => a.name === "General");
    if (!generalArea) {
      const maxOrder = existingAreas.reduce(
        (max, a) => Math.max(max, a.order),
        -1,
      );
      const id = await ctx.db.insert("areas", {
        userId,
        name: "General",
        slug: generateSlug("General"),
        healthStatus: DEFAULT_HEALTH_STATUS,
        order: maxOrder + 1,
        createdAt: Date.now(),
      });
      const created = await ctx.db.get(id);
      if (!created) throw new Error("Failed to create General area");
      generalArea = created;
    }

    for (const project of ungrouped) {
      await ctx.db.patch(project._id, { areaId: generalArea._id });
    }

    return { migrated: ungrouped.length, areaId: generalArea._id };
  },
});
