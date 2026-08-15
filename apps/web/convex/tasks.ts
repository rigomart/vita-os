import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

import type { ProjectedTask } from "./lib/validators";

import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { processInboxTask } from "./lib/inboxProcessing";
import { requireOwned } from "./lib/ownedAccess";
import { emptyPage } from "./lib/pagination";
import { requireTitle } from "./lib/validation";
import { projectedTaskValidator, projectTask } from "./lib/validators";

/**
 * Every Open Task, newest first.
 *
 * Bounded by the Inbox itself: an Open Task is one the user still has to deal
 * with, so this set is what they are willing to look at. Done Tasks grow
 * without limit and are paginated by `listDone` instead.
 */
export const list = query({
  args: {},
  returns: v.array(projectedTaskValidator),
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_inbox", (q) =>
        q.eq("userId", userId).eq("state", "open"),
      )
      .order("desc")
      .collect();
    return tasks.map(projectTask);
  },
});

/** Done Tasks, newest first, one page at a time. */
export const listDone = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(projectedTaskValidator),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return emptyPage<ProjectedTask>();
    const page = await ctx.db
      .query("tasks")
      .withIndex("by_user_inbox", (q) =>
        q.eq("userId", userId).eq("state", "done"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...page, page: page.page.map(projectTask) };
  },
});

export const count = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return 0;
    const open = await ctx.db
      .query("tasks")
      .withIndex("by_user_inbox", (q) =>
        q.eq("userId", userId).eq("state", "open"),
      )
      .collect();
    return open.length;
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    when: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    return ctx.db.insert("tasks", {
      userId,
      text: requireTitle(args.text, "Task text"),
      when: args.when,
      state: "open",
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "tasks", { userId, id: args.id });

    await ctx.db.delete(args.id);
  },
});

export const updateText = mutation({
  args: { id: v.id("tasks"), text: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "tasks", { userId, id: args.id });

    await ctx.db.patch(args.id, {
      text: requireTitle(args.text, "Task text"),
    });
  },
});

export const updateWhen = mutation({
  args: { id: v.id("tasks"), when: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "tasks", { userId, id: args.id });

    await ctx.db.patch(args.id, { when: args.when });
  },
});

export const markDone = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "tasks", { userId, id: args.id });

    await ctx.db.patch(args.id, {
      state: "done",
      completedAt: Date.now(),
    });
  },
});

export const markOpen = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "tasks", { userId, id: args.id });

    await ctx.db.patch(args.id, {
      state: "open",
      completedAt: undefined,
    });
  },
});

export const process = mutation({
  args: {
    id: v.id("tasks"),
    action: v.union(
      v.object({
        type: v.literal("create_thread"),
        title: v.string(),
        areaId: v.id("areas"),
        summary: v.optional(v.string()),
      }),
      v.object({
        type: v.literal("add_activity_log_entry"),
        threadId: v.id("threads"),
      }),
      v.object({
        type: v.literal("set_next_move"),
        threadId: v.id("threads"),
      }),
      v.object({
        type: v.literal("append_up_next"),
        threadId: v.id("threads"),
      }),
      v.object({
        type: v.literal("discard"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await requireOwned(ctx, "tasks", { userId, id: args.id });

    return processInboxTask(ctx, { userId, task, action: args.action });
  },
});
