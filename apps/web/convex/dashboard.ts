import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";

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
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return { areas: [], attentionThreads: [] };

    const areas = await ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    const openThreads = threads.filter((thread) => thread.state === "open");

    const threadCounts: Record<string, number> = {};
    const areaById = new Map(areas.map((area) => [area._id as string, area]));
    const attentionThreads: Array<{
      threadId: string;
      threadName: string;
      threadSlug: string | undefined;
      areaId: string;
      lifecycle: "open";
      nextMove: string | undefined;
      followUp: number | undefined;
    }> = [];

    for (const thread of openThreads) {
      threadCounts[thread.areaId] = (threadCounts[thread.areaId] ?? 0) + 1;

      attentionThreads.push({
        threadId: thread._id,
        threadName: thread.title,
        threadSlug: thread.slug,
        areaId: thread.areaId,
        lifecycle: "open",
        nextMove: thread.nextMove,
        followUp: thread.followUp,
      });
    }

    const attentionCounts: Record<string, number> = {};
    for (const thread of attentionThreads) {
      attentionCounts[thread.areaId] =
        (attentionCounts[thread.areaId] ?? 0) + 1;
    }

    return {
      areas: areas.map((area) => ({
        area,
        threadCount: threadCounts[area._id] ?? 0,
        attentionCount: attentionCounts[area._id] ?? 0,
      })),
      attentionThreads: attentionThreads.map((thread) => {
        const area = areaById.get(thread.areaId);
        return {
          id: thread.threadId,
          key: thread.threadId,
          threadName: thread.threadName,
          name: thread.threadName,
          area,
          areaSlug: area?.slug ?? area?._id ?? thread.areaId,
          threadSlug: thread.threadSlug ?? thread.threadId,
          lifecycle: thread.lifecycle,
          nextMove: thread.nextMove,
          followUp: thread.followUp,
        };
      }),
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
