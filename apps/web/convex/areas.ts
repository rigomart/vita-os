import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAreaCanBeDeleted } from "./lib/areaThreads";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { nullsToUndefined } from "./lib/patch";
import { generateSlug } from "./lib/slugs";
import { validateAreaName } from "./lib/validation";
import { conditionValidator } from "./lib/validators";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("areas") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const area = await ctx.db.get(args.id);
    if (!area || area.userId !== userId) return null;
    return area;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("areas")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug),
      )
      .unique();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    standard: v.optional(v.string()),
    condition: conditionValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    validateAreaName(args.name);

    const nextOrder = await getNextOrder(ctx, "areas", userId);
    const slug = generateSlug(args.name);

    const id = await ctx.db.insert("areas", {
      userId,
      name: args.name,
      slug,
      standard: args.standard,
      condition: args.condition,
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
    standard: v.optional(v.union(v.string(), v.null())),
    condition: v.optional(conditionValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const area = await ctx.db.get(args.id);
    if (!area || area.userId !== userId) {
      throw new Error("Area not found");
    }

    const { id, ...rest } = args;
    if (rest.name !== undefined) {
      validateAreaName(rest.name);
    }
    let newSlug: string | undefined;
    if (rest.name && rest.name !== area.name) {
      newSlug = generateSlug(rest.name);
    }

    await ctx.db.patch(id, {
      ...nullsToUndefined(rest),
      ...(newSlug && { slug: newSlug }),
    });

    return { slug: newSlug ?? area.slug };
  },
});

export const remove = mutation({
  args: { id: v.id("areas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const area = await ctx.db.get(args.id);
    if (!area || area.userId !== userId) {
      throw new Error("Area not found");
    }

    await assertAreaCanBeDeleted(ctx, { userId, areaId: args.id });

    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: {
    tasks: v.array(v.object({ id: v.id("areas"), order: v.number() })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    for (const task of args.tasks) {
      const area = await ctx.db.get(task.id);
      if (!area || area.userId !== userId) {
        throw new Error("Area not found");
      }
      await ctx.db.patch(task.id, { order: task.order });
    }
  },
});
