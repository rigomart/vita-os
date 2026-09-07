import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

import type { ProjectedThreadNote } from "./lib/validators";

import { mutation, query } from "./_generated/server";
import { getAuthUserId, safeGetAuthUserId } from "./lib/helpers";
import { getOwned, requireOwned } from "./lib/ownedAccess";
import { emptyPage } from "./lib/pagination";
import { requireNonBlankText } from "./lib/validation";
import {
  projectedThreadNoteValidator,
  projectThreadNote,
} from "./lib/validators";

export const list = query({
  args: { threadId: v.id("threads") },
  returns: v.array(projectedThreadNoteValidator),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return [];
    const thread = await getOwned(ctx, "threads", {
      userId,
      id: args.threadId,
    });
    if (!thread) return [];

    const notes = await ctx.db
      .query("threadNotes")
      .withIndex("by_user_thread_state", (q) =>
        q.eq("userId", userId).eq("threadId", thread._id).eq("state", "open"),
      )
      .order("desc")
      .collect();
    return notes.map(projectThreadNote);
  },
});

export const listDone = query({
  args: {
    threadId: v.id("threads"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(projectedThreadNoteValidator),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return emptyPage<ProjectedThreadNote>();
    const thread = await getOwned(ctx, "threads", {
      userId,
      id: args.threadId,
    });
    if (!thread) return emptyPage<ProjectedThreadNote>();

    const page = await ctx.db
      .query("threadNotes")
      .withIndex("by_user_thread_completed", (q) =>
        q.eq("userId", userId).eq("threadId", thread._id).eq("state", "done"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...page, page: page.page.map(projectThreadNote) };
  },
});

export const create = mutation({
  args: { threadId: v.id("threads"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const thread = await requireOwned(ctx, "threads", {
      userId,
      id: args.threadId,
    });
    const body = requireNonBlankText(args.body, "Thread note body");
    const now = Date.now();

    const id = await ctx.db.insert("threadNotes", {
      userId,
      threadId: thread._id,
      body,
      updatedAt: now,
      state: "open",
      createdAt: now,
    });
    await ctx.db.patch(thread._id, {
      lastActivityAt: now,
      lastActivityContent: undefined,
    });
    return id;
  },
});

export const updateBody = mutation({
  args: { id: v.id("threadNotes"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await requireOwned(ctx, "threadNotes", { userId, id: args.id });
    await ctx.db.patch(args.id, {
      body: requireNonBlankText(args.body, "Thread note body"),
      updatedAt: Date.now(),
    });
  },
});

export const markDone = mutation({
  args: { id: v.id("threadNotes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await requireOwned(ctx, "threadNotes", { userId, id: args.id });
    const now = Date.now();
    await ctx.db.patch(args.id, {
      state: "done",
      completedAt: now,
    });
  },
});

export const markOpen = mutation({
  args: { id: v.id("threadNotes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await requireOwned(ctx, "threadNotes", { userId, id: args.id });
    await ctx.db.patch(args.id, {
      state: "open",
      completedAt: undefined,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("threadNotes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await requireOwned(ctx, "threadNotes", { userId, id: args.id });
    await ctx.db.delete(args.id);
  },
});
