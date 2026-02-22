import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { nullsToUndefined } from "./lib/patch";
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
    return projects.filter((p) => p.state === "active");
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== String(user._id)) return null;
    if (project.state !== "active") return null;
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
    if (!project || project.state !== "active") return null;
    return project;
  },
});

export const listByArea = query({
  args: { areaId: v.id("areas") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    const userId = String(user._id);
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
    description: v.optional(v.string()),
    definitionOfDone: v.optional(v.string()),
    areaId: v.id("areas"),
  },
  handler: async (ctx, args) => {
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
    description: v.optional(v.union(v.string(), v.null())),
    definitionOfDone: v.optional(v.union(v.string(), v.null())),
    areaId: v.optional(v.id("areas")),
    status: v.optional(v.union(v.string(), v.null())),
    nextAction: v.optional(v.union(v.string(), v.null())),
    nextReviewDate: v.optional(v.union(v.number(), v.null())),
    state: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("dropped"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const { id, ...rest } = args;

    let newSlug: string | undefined;
    if (rest.name && rest.name !== project.name) {
      newSlug = generateSlug(rest.name);
    }

    await ctx.db.patch(id, {
      ...nullsToUndefined(rest),
      ...(newSlug && { slug: newSlug }),
    });

    return { slug: newSlug ?? project.slug };
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

    await ctx.db.patch(args.id, { state: "dropped" });
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
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

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
        healthStatus: "healthy",
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
