import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { buildDashboardOverview } from "./lib/dashboard";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { areaIconValidator, conditionValidator } from "./lib/validators";

const dashboardAreaValidator = v.object({
  id: v.id("areas"),
  name: v.string(),
  slug: v.string(),
  condition: conditionValidator,
  icon: v.optional(areaIconValidator),
  order: v.number(),
});

const dashboardThreadValidator = v.object({
  id: v.id("threads"),
  title: v.string(),
  slug: v.string(),
  summary: v.optional(v.string()),
  areaId: v.id("areas"),
  nextMove: v.optional(v.string()),
  followUp: v.optional(v.number()),
  order: v.number(),
});

const dashboardOverviewValidator = v.object({
  areas: v.array(dashboardAreaValidator),
  threads: v.array(dashboardThreadValidator),
  inbox: v.object({
    items: v.array(
      v.object({
        id: v.id("tasks"),
        text: v.string(),
        when: v.optional(v.number()),
        createdAt: v.number(),
      }),
    ),
    totalOpen: v.number(),
  }),
  recentActivity: v.array(
    v.object({
      id: v.id("activityLogs"),
      threadId: v.id("threads"),
      content: v.string(),
      createdAt: v.number(),
    }),
  ),
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
    if (!userId) {
      return {
        areas: [],
        threads: [],
        inbox: { items: [], totalOpen: 0 },
        recentActivity: [],
      };
    }

    const [areas, threads, tasks, activityLogs] = await Promise.all([
      ctx.db
        .query("areas")
        .withIndex("by_user_order", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("threads")
        .withIndex("by_user_state", (q) =>
          q.eq("userId", userId).eq("state", "open"),
        )
        .collect(),
      ctx.db
        .query("tasks")
        .withIndex("by_user_inbox", (q) =>
          q.eq("userId", userId).eq("state", "open"),
        )
        .collect(),
      ctx.db
        .query("activityLogs")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(50),
    ]);

    return buildDashboardOverview(userId, {
      areas,
      threads,
      tasks,
      activityLogs,
    });
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
