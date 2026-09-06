import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

import type { ProjectedNote } from "./lib/validators";

import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { requireOwned } from "./lib/ownedAccess";
import { emptyPage } from "./lib/pagination";
import { requireTitle } from "./lib/validation";
import { projectedNoteValidator, projectNote } from "./lib/validators";

/**
 * Every Open Note, newest first.
 *
 * Bounded by the Inbox itself: an Open Note is one the user still has to deal
 * with, so this set is what they are willing to look at. Done Notes grow
 * without limit and are paginated by `listDone` instead.
 */
export const list = query({
  args: {},
  returns: v.array(projectedNoteValidator),
  handler: async (ctx) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const notes = await ctx.db
      .query("tasks")
      .withIndex("by_user_inbox", (q) =>
        q.eq("userId", userId).eq("state", "open"),
      )
      .order("desc")
      .collect();
    return notes.map(projectNote);
  },
});

/** Done Notes, newest first, one page at a time. */
export const listDone = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(projectedNoteValidator),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return emptyPage<ProjectedNote>();
    const page = await ctx.db
      .query("tasks")
      .withIndex("by_user_completed", (q) =>
        q.eq("userId", userId).eq("state", "done"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...page, page: page.page.map(projectNote) };
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
    body: v.string(),
    when: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const now = Date.now();
    return ctx.db.insert("tasks", {
      userId,
      text: requireTitle(args.body, "Note body"),
      updatedAt: now,
      when: args.when,
      state: "open",
      createdAt: now,
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

export const updateBody = mutation({
  args: { id: v.id("tasks"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "tasks", { userId, id: args.id });

    await ctx.db.patch(args.id, {
      text: requireTitle(args.body, "Note body"),
      updatedAt: Date.now(),
    });
  },
});

export const updateWhen = mutation({
  args: { id: v.id("tasks"), when: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await requireOwned(ctx, "tasks", { userId, id: args.id });

    await ctx.db.patch(args.id, { when: args.when, updatedAt: Date.now() });
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
      updatedAt: Date.now(),
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
      updatedAt: Date.now(),
    });
  },
});
