import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { getOwned, getOwnedBySlug, requireOwned } from "./lib/ownedAccess";
import { nullsToUndefined } from "./lib/patch";
import { generateSlug } from "./lib/slugs";
import {
  applyThreadPatch,
  completeNextMove,
  sanitizeThreadPatch,
} from "./lib/threadChanges";
import { requireTitle } from "./lib/validation";
import {
  projectArea,
  projectedAreaValidator,
  projectedThreadValidator,
  projectThread,
} from "./lib/validators";

/**
 * Every Open Thread, in the user's manual order.
 *
 * The index selects the Open ones; `order` is a per-user ranking that no
 * index can combine with `state`, so the sort happens here — over a set the
 * user themselves keeps small by resolving Threads.
 */
export const list = query({
  args: {},
  returns: v.array(projectedThreadValidator),
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user_state", (q) =>
        q.eq("userId", userId).eq("state", "open"),
      )
      .collect();
    return threads.sort((a, b) => a.order - b.order).map(projectThread);
  },
});

export const get = query({
  args: { id: v.id("threads") },
  returns: v.union(projectedThreadValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const thread = await getOwned(ctx, "threads", { userId, id: args.id });
    return thread && projectThread(thread);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(projectedThreadValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const thread = await getOwnedBySlug(ctx, "threads", {
      userId,
      slug: args.slug,
    });
    return thread && projectThread(thread);
  },
});

/**
 * Everything the Thread rail renders, in one subscription: the Thread and the
 * Area it is filed under. `area` is null only when the Area is gone mid-flight
 * — the rail treats that as not found.
 */
export const detailBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      thread: projectedThreadValidator,
      area: v.union(projectedAreaValidator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;

    const thread = await getOwnedBySlug(ctx, "threads", {
      userId,
      slug: args.slug,
    });
    if (!thread) return null;

    const area = await getOwned(ctx, "areas", { userId, id: thread.areaId });
    return { thread: projectThread(thread), area: area && projectArea(area) };
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
    await requireOwned(ctx, "areas", { userId, id: args.areaId });

    const title = requireTitle(args.title, "Thread title");

    const nextOrder = await getNextOrder(ctx, "threads", userId);
    const slug = generateSlug(title);

    const id = await ctx.db.insert("threads", {
      userId,
      title,
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

    const thread = await requireOwned(ctx, "threads", { userId, id });

    if (rest.areaId !== undefined) {
      await requireOwned(ctx, "areas", { userId, id: rest.areaId });
    }

    const title =
      rest.title === undefined
        ? undefined
        : requireTitle(rest.title, "Thread title");

    let newSlug: string | undefined;
    if (title !== undefined && title !== thread.title) {
      newSlug = generateSlug(title);
    }

    const patch = sanitizeThreadPatch({
      ...nullsToUndefined(rest),
      ...(title !== undefined && { title }),
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

/**
 * Delete a Thread and the Activity Log it accumulated.
 *
 * Activity Log entries exist only as a Thread's history, so they go with it —
 * left behind they would be unreachable rows that still count against every
 * user-scoped read.
 */
export const remove = mutation({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const thread = await requireOwned(ctx, "threads", {
      userId,
      id: args.id,
    });

    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_user_thread", (q) =>
        q.eq("userId", userId).eq("threadId", thread._id),
      )
      .collect();
    await Promise.all(logs.map((log) => ctx.db.delete(log._id)));

    await ctx.db.delete(thread._id);
  },
});

export const completeNextMoveMutation = mutation({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const thread = await requireOwned(ctx, "threads", {
      userId,
      id: args.id,
    });

    await completeNextMove(ctx, { userId, thread });
  },
});
