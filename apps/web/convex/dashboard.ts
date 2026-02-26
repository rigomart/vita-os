import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";

export const attention = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return { items: [], byArea: {} as Record<string, number> };

    const activeProjects = await ctx.db
      .query("projects")
      .withIndex("by_user_state", (q) =>
        q.eq("userId", userId).eq("state", "active"),
      )
      .collect();

    const items: Array<{
      projectId: string;
      projectName: string;
      projectSlug: string | undefined;
      areaId: string;
      reason: "no_next_action";
    }> = [];

    for (const project of activeProjects) {
      const hasAction =
        (project.actionQueue?.length ?? 0) > 0 || project.nextAction;
      if (!hasAction) {
        items.push({
          projectId: project._id,
          projectName: project.name,
          projectSlug: project.slug,
          areaId: project.areaId,
          reason: "no_next_action",
        });
      }
    }

    const byArea: Record<string, number> = {};
    const seenByArea = new Map<string, Set<string>>();
    for (const item of items) {
      if (!seenByArea.has(item.areaId)) {
        seenByArea.set(item.areaId, new Set());
      }
      seenByArea.get(item.areaId)?.add(item.projectId);
    }
    for (const [areaId, projectSet] of seenByArea) {
      byArea[areaId] = projectSet.size;
    }

    return { items, byArea };
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
