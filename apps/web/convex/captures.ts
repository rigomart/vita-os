import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId, getNextOrder, safeGetAuthUserId } from "./lib/helpers";
import { generateSlug } from "./lib/slugs";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("captures")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return 0;
    const captures = await ctx.db
      .query("captures")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return captures.length;
  },
});

export const create = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    return ctx.db.insert("captures", {
      userId,
      text: args.text,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("captures") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const capture = await ctx.db.get(args.id);
    if (!capture || capture.userId !== userId) {
      throw new Error("Capture not found");
    }

    await ctx.db.delete(args.id);
  },
});

export const process = mutation({
  args: {
    id: v.id("captures"),
    action: v.union(
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

    const capture = await ctx.db.get(args.id);
    if (!capture || capture.userId !== userId) {
      throw new Error("Capture not found");
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
        content: capture.text,
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
        content: capture.text,
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
      const newItem = { id: crypto.randomUUID(), text: capture.text };
      const newQueue = [newItem, ...currentQueue];
      const prev = currentQueue[0]?.text ?? project.nextAction ?? "";

      await ctx.db.patch(args.action.projectId, {
        actionQueue: newQueue,
      });

      await ctx.db.insert("projectLogs", {
        userId,
        projectId: args.action.projectId,
        type: "next_action_change",
        content: prev
          ? `Next action changed from "${prev}" to "${capture.text}"`
          : `Next action set to "${capture.text}"`,
        previousValue: prev || undefined,
        newValue: capture.text,
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
