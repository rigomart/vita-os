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
      const hasAction = (project.actionQueue?.length ?? 0) > 0;
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

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return { areas: [], attentionItems: [] };

    const areas = await ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();
    const activeProjects = await ctx.db
      .query("projects")
      .withIndex("by_user_state", (q) =>
        q.eq("userId", userId).eq("state", "active"),
      )
      .collect();

    const projectCounts: Record<string, number> = {};
    const attentionCounts: Record<string, number> = {};
    const areaById = new Map(areas.map((area) => [area._id as string, area]));
    const attentionItems: Array<{
      projectId: string;
      projectName: string;
      projectSlug: string | undefined;
      areaId: string;
      reason: "no_next_action";
    }> = [];

    for (const project of activeProjects) {
      projectCounts[project.areaId] = (projectCounts[project.areaId] ?? 0) + 1;

      const hasAction = (project.actionQueue?.length ?? 0) > 0;
      if (!hasAction) {
        attentionItems.push({
          projectId: project._id,
          projectName: project.name,
          projectSlug: project.slug,
          areaId: project.areaId,
          reason: "no_next_action",
        });
        attentionCounts[project.areaId] =
          (attentionCounts[project.areaId] ?? 0) + 1;
      }
    }

    return {
      areas: areas.map((area) => ({
        area,
        projectCount: projectCounts[area._id] ?? 0,
        attentionCount: attentionCounts[area._id] ?? 0,
      })),
      attentionItems: attentionItems.map((item) => {
        const area = areaById.get(item.areaId);
        return {
          key: `${item.projectId}-${item.reason}`,
          projectName: item.projectName,
          area,
          areaSlug: area?.slug ?? area?._id ?? item.areaId,
          projectSlug: item.projectSlug ?? item.projectId,
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
