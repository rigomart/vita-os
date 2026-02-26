import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { nullsToUndefined } from "./lib/patch";
import { generateSlug } from "./lib/slugs";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("projects")
      .withIndex("by_user_state", (q) =>
        q.eq("userId", userId).eq("state", "active"),
      )
      .collect();
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) return null;
    if (project.state !== "active") return null;
    return project;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return null;
    const project = await ctx.db
      .query("projects")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", userId).eq("slug", args.slug),
      )
      .unique();
    if (!project || project.state !== "active") return null;
    return project;
  },
});

export const listByArea = query({
  args: { areaId: v.id("areas") },
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
      .collect();
    return projects.filter((p) => p.userId === userId && p.state === "active");
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    definitionOfDone: v.optional(v.string()),
    areaId: v.id("areas"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const nextOrder = await getNextOrder(ctx, "projects", userId);
    const slug = generateSlug(args.name);

    const id = await ctx.db.insert("projects", {
      userId,
      name: args.name,
      slug,
      definitionOfDone: args.definitionOfDone,
      areaId: args.areaId,
      order: nextOrder,
      state: "active",
      createdAt: Date.now(),
    });

    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    definitionOfDone: v.optional(v.union(v.string(), v.null())),
    areaId: v.optional(v.id("areas")),
    status: v.optional(v.union(v.string(), v.null())),
    nextAction: v.optional(v.union(v.string(), v.null())),
    actionQueue: v.optional(
      v.union(
        v.array(v.object({ id: v.string(), text: v.string() })),
        v.null(),
      ),
    ),
    state: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("dropped"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const { id, ...rest } = args;

    let newSlug: string | undefined;
    if (rest.name && rest.name !== project.name) {
      newSlug = generateSlug(rest.name);
    }

    await ctx.db.patch(id, {
      ...nullsToUndefined(rest),
      ...(newSlug && { slug: newSlug }),
    });

    // Auto-generate log entries for tracked field changes
    const now = Date.now();

    if (
      args.status !== undefined &&
      (args.status ?? undefined) !== (project.status ?? undefined)
    ) {
      const prev = project.status ?? "";
      const next = args.status === null ? "" : args.status;
      await ctx.db.insert("projectLogs", {
        userId,
        projectId: id,
        type: "status_change",
        content: prev
          ? `Status changed from "${prev}" to "${next || "(cleared)"}"`
          : `Status set to "${next}"`,
        previousValue: prev || undefined,
        newValue: next || undefined,
        createdAt: now,
      });
    }

    if (
      args.nextAction !== undefined &&
      (args.nextAction ?? undefined) !== (project.nextAction ?? undefined)
    ) {
      const prev = project.nextAction ?? "";
      const next = args.nextAction === null ? "" : args.nextAction;
      await ctx.db.insert("projectLogs", {
        userId,
        projectId: id,
        type: "next_action_change",
        content: prev
          ? `Next action changed from "${prev}" to "${next || "(cleared)"}"`
          : `Next action set to "${next}"`,
        previousValue: prev || undefined,
        newValue: next || undefined,
        createdAt: now,
      });
    }

    if (args.actionQueue !== undefined) {
      const oldQueue = project.actionQueue ?? [];
      const newQueue = args.actionQueue ?? [];
      const oldFirst = oldQueue[0]?.text ?? "";
      const newFirst = newQueue[0]?.text ?? "";

      if (oldFirst !== newFirst) {
        await ctx.db.insert("projectLogs", {
          userId,
          projectId: id,
          type: "next_action_change",
          content: oldFirst
            ? `Next action changed from "${oldFirst}" to "${newFirst || "(cleared)"}"`
            : `Next action set to "${newFirst}"`,
          previousValue: oldFirst || undefined,
          newValue: newFirst || undefined,
          createdAt: now,
        });
      }
    }

    if (args.state !== undefined && args.state !== project.state) {
      await ctx.db.insert("projectLogs", {
        userId,
        projectId: id,
        type: "state_change",
        content: `State changed from "${project.state}" to "${args.state}"`,
        previousValue: project.state,
        newValue: args.state,
        createdAt: now,
      });
    }

    return { slug: newSlug ?? project.slug };
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    await ctx.db.patch(args.id, { state: "dropped" });

    if (project.state !== "dropped") {
      await ctx.db.insert("projectLogs", {
        userId,
        projectId: args.id,
        type: "state_change",
        content: `State changed from "${project.state}" to "dropped"`,
        previousValue: project.state,
        newValue: "dropped",
        createdAt: Date.now(),
      });
    }
  },
});

export const completeAction = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const queue = project.actionQueue ?? [];
    if (queue.length === 0) return;

    const completed = queue[0];
    const remaining = queue.slice(1);
    const next = remaining[0]?.text ?? "";

    await ctx.db.patch(args.id, { actionQueue: remaining });

    await ctx.db.insert("projectLogs", {
      userId,
      projectId: args.id,
      type: "next_action_change",
      content: next
        ? `Completed "${completed.text}" — next action is now "${next}"`
        : `Completed "${completed.text}" — no more actions queued`,
      previousValue: completed.text,
      newValue: next || undefined,
      createdAt: Date.now(),
    });
  },
});

export const migrateNextActionToQueue = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let count = 0;
    for (const project of projects) {
      if (project.nextAction && !project.actionQueue) {
        await ctx.db.patch(project._id, {
          actionQueue: [{ id: crypto.randomUUID(), text: project.nextAction }],
        });
        count++;
      }
    }
    return { migrated: count };
  },
});

export const backfillSlugs = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let count = 0;
    for (const project of projects) {
      if (!project.slug) {
        const slug = generateSlug(project.name);
        await ctx.db.patch(project._id, { slug });
        count++;
      }
    }
    return { backfilled: count };
  },
});

export const migrateUngrouped = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    const ungrouped = projects.filter((p) => !p.areaId);
    if (ungrouped.length === 0) return { migrated: 0 };

    // Find or create a "General" area
    const existingAreas = await ctx.db
      .query("areas")
      .withIndex("by_user_order", (q) => q.eq("userId", userId))
      .collect();

    let generalArea = existingAreas.find((a) => a.name === "General");
    if (!generalArea) {
      const maxOrder = existingAreas.reduce(
        (max, a) => Math.max(max, a.order),
        -1,
      );
      const id = await ctx.db.insert("areas", {
        userId,
        name: "General",
        slug: generateSlug("General"),
        healthStatus: "healthy",
        order: maxOrder + 1,
        createdAt: Date.now(),
      });
      const created = await ctx.db.get(id);
      if (!created) throw new Error("Failed to create General area");
      generalArea = created;
    }

    for (const project of ungrouped) {
      await ctx.db.patch(project._id, { areaId: generalArea._id });
    }

    return { migrated: ungrouped.length, areaId: generalArea._id };
  },
});
