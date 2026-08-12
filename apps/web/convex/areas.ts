import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  assertAreaCanBeDeleted,
  listOpenThreadsInAreaForUser,
} from "./lib/areaThreads";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { getOwned, getOwnedBySlug, requireOwned } from "./lib/ownedAccess";
import { nullsToUndefined } from "./lib/patch";
import { generateSlug } from "./lib/slugs";
import { validateAreaName } from "./lib/validation";
import {
  areaIconValidator,
  conditionValidator,
  projectArea,
  projectedAreaValidator,
  projectedThreadValidator,
  projectThread,
} from "./lib/validators";

export const list = query({
  args: {},
  returns: v.array(projectedAreaValidator),
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const areas = await ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    return areas.map(projectArea);
  },
});

export const get = query({
  args: { id: v.id("areas") },
  returns: v.union(projectedAreaValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const area = await getOwned(ctx, "areas", { userId, id: args.id });
    return area && projectArea(area);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(projectedAreaValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const area = await getOwnedBySlug(ctx, "areas", {
      userId,
      slug: args.slug,
    });
    return area && projectArea(area);
  },
});

/**
 * Everything the Area page renders, in one subscription: the Area and its
 * Open Threads. Keyed by slug because that is what the URL carries.
 */
export const detailBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      area: projectedAreaValidator,
      threads: v.array(projectedThreadValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;

    const area = await getOwnedBySlug(ctx, "areas", {
      userId,
      slug: args.slug,
    });
    if (!area) return null;

    const threads = await listOpenThreadsInAreaForUser(ctx, {
      userId,
      areaId: area._id,
    });
    return { area: projectArea(area), threads: threads.map(projectThread) };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    standard: v.optional(v.string()),
    condition: conditionValidator,
    icon: areaIconValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const name = validateAreaName(args.name);

    const nextOrder = await getNextOrder(ctx, "areas", userId);
    const slug = generateSlug(name);

    const id = await ctx.db.insert("areas", {
      userId,
      name,
      slug,
      standard: args.standard,
      condition: args.condition,
      icon: args.icon,
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
    icon: v.optional(areaIconValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const area = await requireOwned(ctx, "areas", { userId, id: args.id });

    const { id, ...rest } = args;
    const name =
      rest.name === undefined ? undefined : validateAreaName(rest.name);

    let newSlug: string | undefined;
    if (name !== undefined && name !== area.name) {
      newSlug = generateSlug(name);
    }

    await ctx.db.patch(id, {
      ...nullsToUndefined(rest),
      ...(name !== undefined && { name }),
      ...(newSlug && { slug: newSlug }),
    });

    return { slug: newSlug ?? area.slug };
  },
});

export const remove = mutation({
  args: { id: v.id("areas") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "areas", { userId, id: args.id });

    await assertAreaCanBeDeleted(ctx, { userId, areaId: args.id });

    await ctx.db.delete(args.id);
  },
});
