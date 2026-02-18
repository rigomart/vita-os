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
    return ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("areas") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const area = await ctx.db.get(args.id);
    if (!area || area.userId !== String(user._id)) return null;
    return area;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const userId = String(user._id);
    return ctx.db
      .query("areas")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug),
      )
      .unique();
  },
});

const healthStatusValidator = v.union(
  v.literal("healthy"),
  v.literal("needs_attention"),
  v.literal("critical"),
);

export const create = mutation({
  args: {
    name: v.string(),
    standard: v.optional(v.string()),
    healthStatus: healthStatusValidator,
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const existing = await ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const nextOrder = existing ? existing.order + 1 : 0;
    const slug = generateSlug(args.name);

    const id = await ctx.db.insert("areas", {
      userId,
      name: args.name,
      slug,
      standard: args.standard,
      healthStatus: args.healthStatus,
      order: nextOrder,
      createdAt: Date.now(),
    });

    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("areas"),
    name: v.optional(v.string()),
    standard: v.optional(v.string()),
    clearStandard: v.optional(v.boolean()),
    healthStatus: v.optional(healthStatusValidator),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const area = await ctx.db.get(args.id);
    if (!area || area.userId !== userId) {
      throw new Error("Area not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) {
      updates.name = args.name;
      updates.slug = generateSlug(args.name);
    }
    if (args.clearStandard) {
      updates.standard = undefined;
    } else if (args.standard !== undefined) {
      updates.standard = args.standard;
    }
    if (args.healthStatus !== undefined) {
      updates.healthStatus = args.healthStatus;
    }

    await ctx.db.patch(args.id, updates);

    return { slug: (updates.slug as string) ?? area.slug };
  },
});

export const remove = mutation({
  args: { id: v.id("areas") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    const area = await ctx.db.get(args.id);
    if (!area || area.userId !== userId) {
      throw new Error("Area not found");
    }

    // Unassign all projects from this area
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_area", (q) => q.eq("areaId", args.id))
      .collect();

    for (const project of projects) {
      await ctx.db.patch(project._id, { areaId: undefined });
    }

    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: {
    items: v.array(v.object({ id: v.id("areas"), order: v.number() })),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

    for (const item of args.items) {
      const area = await ctx.db.get(item.id);
      if (!area || area.userId !== userId) {
        throw new Error("Area not found");
      }
      await ctx.db.patch(item.id, { order: item.order });
    }
  },
});
