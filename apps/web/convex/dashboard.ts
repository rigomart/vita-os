import { v } from "convex/values";

import { query } from "./_generated/server";
import { buildDashboardOverview } from "./lib/dashboard";
import { safeGetAuthUserId } from "./lib/helpers";
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

export const overview = query({
  args: {
    currentDate: v.number(),
    timezoneOffsetMinutes: v.number(),
  },
  returns: dashboardOverviewValidator,
  handler: async (ctx, args) => {
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

    return buildDashboardOverview(
      userId,
      {
        areas,
        threads,
        tasks,
        activityLogs,
      },
      args.currentDate,
      args.timezoneOffsetMinutes,
    );
  },
});
