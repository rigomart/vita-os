import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { conditionValidator } from "./lib/validators";

const areaOverviewValidator = v.object({
  _id: v.id("areas"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  slug: v.optional(v.string()),
  standard: v.optional(v.string()),
  condition: conditionValidator,
  order: v.number(),
  createdAt: v.number(),
});

const dashboardThreadValidator = v.object({
  id: v.id("threads"),
  key: v.string(),
  threadName: v.string(),
  name: v.string(),
  area: v.optional(areaOverviewValidator),
  areaId: v.id("areas"),
  areaSlug: v.string(),
  threadSlug: v.string(),
  lifecycle: v.literal("open"),
  nextMove: v.optional(v.string()),
  followUp: v.optional(v.number()),
});

const dashboardOverviewValidator = v.object({
  areas: v.array(
    v.object({
      area: areaOverviewValidator,
      threadCount: v.number(),
      attentionCount: v.number(),
    }),
  ),
  threads: v.array(dashboardThreadValidator),
});

export const attention = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return { tasks: [], byArea: {} as Record<string, number> };

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    const openThreads = threads.filter((thread) => thread.state === "open");

    const tasks: Array<{
      threadId: string;
      threadName: string;
      threadSlug: string | undefined;
      areaId: string;
      reason: "no_next_action";
    }> = [];

    for (const thread of openThreads) {
      const hasAction = thread.nextMove != null;
      if (!hasAction) {
        tasks.push({
          threadId: thread._id,
          threadName: thread.title,
          threadSlug: thread.slug,
          areaId: thread.areaId,
          reason: "no_next_action",
        });
      }
    }

    const byArea: Record<string, number> = {};
    const seenByArea = new Map<string, Set<string>>();
    for (const task of tasks) {
      if (!seenByArea.has(task.areaId)) {
        seenByArea.set(task.areaId, new Set());
      }
      seenByArea.get(task.areaId)?.add(task.threadId);
    }
    for (const [areaId, threadSet] of seenByArea) {
      byArea[areaId] = threadSet.size;
    }

    return { tasks, byArea };
  },
});

export const overview = query({
  args: {},
  returns: dashboardOverviewValidator,
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return { areas: [], threads: [] };

    const areas = await ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user_state", (q) =>
        q.eq("userId", userId).eq("state", "open"),
      )
      .collect();
    const openThreads = [...threads].sort((a, b) => a.order - b.order);

    const threadCounts: Record<string, number> = {};
    const areaById = new Map(areas.map((area) => [area._id as string, area]));

    for (const thread of openThreads) {
      threadCounts[thread.areaId] = (threadCounts[thread.areaId] ?? 0) + 1;
    }

    const dashboardThreads = openThreads.map((thread) => {
      const area = areaById.get(thread.areaId);
      return {
        id: thread._id,
        key: thread._id as string,
        threadName: thread.title,
        name: thread.title,
        area,
        areaId: thread.areaId,
        areaSlug: (area?.slug ?? area?._id ?? thread.areaId) as string,
        threadSlug: (thread.slug ?? thread._id) as string,
        lifecycle: "open" as const,
        nextMove: thread.nextMove,
        followUp: thread.followUp,
      };
    });

    return {
      areas: areas.map((area) => ({
        area,
        threadCount: threadCounts[area._id] ?? 0,
        attentionCount: threadCounts[area._id] ?? 0,
      })),
      threads: dashboardThreads,
    };
  },
});

export const lastReview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return settings?.lastReviewDate ?? null;
  },
});

export const markReviewed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastReviewDate: now,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        lastReviewDate: now,
      });
    }

    return now;
  },
});
