import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { generateSlug } from "./lib/slugs";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db
      .query("items")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return all.filter((item) => !item.isCompleted);
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return 0;
    const all = await ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return all.filter((item) => !item.isCompleted).length;
  },
});

export const listCompleted = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const all = await ctx.db
      .query("items")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return all.filter((item) => item.isCompleted);
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    return ctx.db.insert("items", {
      userId,
      text: args.text,
      date: args.date,
      isCompleted: false,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.delete(args.id);
  },
});

export const complete = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.id, {
      isCompleted: true,
      completedAt: Date.now(),
    });
  },
});

export const uncomplete = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.id, {
      isCompleted: false,
      completedAt: undefined,
    });
  },
});

export const process = mutation({
  args: {
    id: v.id("items"),
    action: v.union(
      v.object({
        type: v.literal("add_date"),
        date: v.number(),
      }),
      v.object({
        type: v.literal("create_project"),
        name: v.string(),
        areaId: v.id("areas"),
        definitionOfDone: v.optional(v.string()),
      }),
      v.object({
        type: v.literal("add_to_project"),
        projectId: v.id("projects"),
      }),
      v.object({
        type: v.literal("set_next_action"),
        projectId: v.id("projects"),
      }),
      v.object({
        type: v.literal("discard"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    if (args.action.type === "add_date") {
      await ctx.db.patch(args.id, { date: args.action.date });
      return { type: "dated" as const };
    }

    if (args.action.type === "create_project") {
      const nextOrder = await getNextOrder(ctx, "projects", userId);
      const slug = generateSlug(args.action.name);

      const projectId = await ctx.db.insert("projects", {
        userId,
        name: args.action.name,
        slug,
        definitionOfDone: args.action.definitionOfDone,
        areaId: args.action.areaId,
        order: nextOrder,
        state: "active",
        createdAt: Date.now(),
      });

      await ctx.db.insert("projectLogs", {
        userId,
        projectId,
        type: "note",
        content: item.text,
        createdAt: Date.now(),
      });

      await ctx.db.delete(args.id);
      return { type: "created" as const, slug };
    }

    if (args.action.type === "add_to_project") {
      const project = await ctx.db.get(args.action.projectId);
      if (!project || project.userId !== userId) {
        throw new Error("Project not found");
      }

      await ctx.db.insert("projectLogs", {
        userId,
        projectId: args.action.projectId,
        type: "note",
        content: item.text,
        createdAt: Date.now(),
      });

      await ctx.db.delete(args.id);
      return { type: "added" as const };
    }

    if (args.action.type === "set_next_action") {
      const project = await ctx.db.get(args.action.projectId);
      if (!project || project.userId !== userId) {
        throw new Error("Project not found");
      }

      const currentQueue = project.actionQueue ?? [];
      const newQueueItem = { id: crypto.randomUUID(), text: item.text };
      const newQueue = [newQueueItem, ...currentQueue];
      const prev = currentQueue[0]?.text ?? project.nextAction ?? "";

      await ctx.db.patch(args.action.projectId, {
        actionQueue: newQueue,
      });

      await ctx.db.insert("projectLogs", {
        userId,
        projectId: args.action.projectId,
        type: "next_action_change",
        content: prev
          ? `Next action changed from "${prev}" to "${item.text}"`
          : `Next action set to "${item.text}"`,
        previousValue: prev || undefined,
        newValue: item.text,
        createdAt: Date.now(),
      });

      await ctx.db.delete(args.id);
      return { type: "set_next_action" as const };
    }

    // discard
    await ctx.db.delete(args.id);
    return { type: "discarded" as const };
  },
});
