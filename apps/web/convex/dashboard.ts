import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const attention = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { items: [], byArea: {} as Record<string, number> };
    const userId = String(user._id);
    const now = Date.now();

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    const activeProjects = projects.filter((p) => p.state === "active");

    const items: Array<{
      projectId: string;
      projectName: string;
      projectSlug: string | undefined;
      areaId: string;
      reason: "no_next_action" | "review_overdue";
      overdueBy?: number;
    }> = [];

    for (const project of activeProjects) {
      if (!project.nextAction) {
        items.push({
          projectId: project._id,
          projectName: project.name,
          projectSlug: project.slug,
          areaId: project.areaId,
          reason: "no_next_action",
        });
      }
      if (project.nextReviewDate && project.nextReviewDate < now) {
        items.push({
          projectId: project._id,
          projectName: project.name,
          projectSlug: project.slug,
          areaId: project.areaId,
          reason: "review_overdue",
          overdueBy: now - project.nextReviewDate,
        });
      }
    }

    items.sort((a, b) => {
      if (a.reason === "no_next_action" && b.reason !== "no_next_action")
        return -1;
      if (a.reason !== "no_next_action" && b.reason === "no_next_action")
        return 1;
      if (a.reason === "review_overdue" && b.reason === "review_overdue") {
        return (b.overdueBy ?? 0) - (a.overdueBy ?? 0);
      }
      return 0;
    });

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
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const userId = String(user._id);

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
    const user = await authComponent.getAuthUser(ctx);
    const userId = String(user._id);

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
