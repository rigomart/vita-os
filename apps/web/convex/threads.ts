import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAreaForUser } from "./lib/areaThreads";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { nullsToUndefined } from "./lib/patch";
import { generateSlug } from "./lib/slugs";
import {
  applyThreadPatch,
  completeNextMove,
  sanitizeThreadPatch,
} from "./lib/threadChanges";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    return threads.filter((thread) => thread.state === "open");
  },
});

export const get = query({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const thread = await ctx.db.get(args.id);
    if (!thread || thread.userId !== userId) return null;
    return thread;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug),
      )
      .unique();
    if (!thread || thread.userId !== userId) return null;
    return thread;
  },
});

export const listByArea = query({
  args: { areaId: v.id("areas") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
      .collect();
    return threads.filter(
      (thread) => thread.userId === userId && thread.state === "open",
    );
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    summary: v.optional(v.string()),
    areaId: v.id("areas"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await getAreaForUser(ctx, { userId, areaId: args.areaId });

    const nextOrder = await getNextOrder(ctx, "threads", userId);
    const slug = generateSlug(args.title);

    const id = await ctx.db.insert("threads", {
      userId,
      title: args.title,
      slug,
      summary: args.summary,
      areaId: args.areaId,
      order: nextOrder,
      state: "open",
      createdAt: Date.now(),
    });

    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("threads"),
    title: v.optional(v.string()),
    summary: v.optional(v.union(v.string(), v.null())),
    areaId: v.optional(v.id("areas")),
    nextMove: v.optional(v.union(v.string(), v.null())),
    followUp: v.optional(v.union(v.number(), v.null())),
    state: v.optional(v.union(v.literal("open"), v.literal("resolved"))),
    resolutionNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const { id, resolutionNote, ...rest } = args;

    const thread = await ctx.db.get(id);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    if (rest.areaId !== undefined) {
      await getAreaForUser(ctx, { userId, areaId: rest.areaId });
    }

    let newSlug: string | undefined;
    if (rest.title && rest.title !== thread.title) {
      newSlug = generateSlug(rest.title);
    }

    const patch = sanitizeThreadPatch({
      ...nullsToUndefined(rest),
      ...(newSlug && { slug: newSlug }),
    });

    await applyThreadPatch(ctx, {
      userId,
      thread,
      patch,
      resolutionNote,
    });

    return { slug: newSlug ?? thread.slug };
  },
});

export const remove = mutation({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const thread = await ctx.db.get(args.id);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    await ctx.db.delete(thread._id);
  },
});

export const completeNextMoveMutation = mutation({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const thread = await ctx.db.get(args.id);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    await completeNextMove(ctx, { userId, thread });
  },
});
