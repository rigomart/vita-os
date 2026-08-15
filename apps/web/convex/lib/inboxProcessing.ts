import type { GenericMutationCtx } from "convex/server";

import type { DataModel, Doc, Id } from "../_generated/dataModel";

import { recordActivity } from "./activityWrites";
import { getNextOrder } from "./helpers";
import { requireOwned } from "./ownedAccess";
import { generateSlug } from "./slugs";
import { applyThreadPatch } from "./threadChanges";
import { storedUpNext } from "./upNext";
import { requireTitle } from "./validation";

type MutationCtx = GenericMutationCtx<DataModel>;

export type InboxProcessingAction =
  | {
      type: "create_thread";
      title: string;
      areaId: Id<"areas">;
      summary?: string;
    }
  | { type: "add_activity_log_entry"; threadId: Id<"threads"> }
  | { type: "set_next_move"; threadId: Id<"threads"> }
  | { type: "append_up_next"; threadId: Id<"threads"> }
  | { type: "discard" };

export type InboxProcessingResult =
  | { type: "created"; slug: string }
  | { type: "added" }
  | { type: "set_next_move" }
  | { type: "appended_up_next" }
  | { type: "discarded" };

export type TaskProcessingDisposition = "keep_task" | "delete_task";

export function getTaskProcessingDisposition(
  _action: InboxProcessingAction,
): TaskProcessingDisposition {
  return "delete_task";
}

export function getInboxProcessingResultType(
  action: InboxProcessingAction,
): InboxProcessingResult["type"] {
  if (action.type === "create_thread") return "created";
  if (action.type === "add_activity_log_entry") return "added";
  if (action.type === "set_next_move") return "set_next_move";
  if (action.type === "append_up_next") return "appended_up_next";
  return "discarded";
}

export function buildThreadNoteFromTask(task: Doc<"tasks">): {
  type: "note";
  content: string;
} {
  return { type: "note", content: task.text };
}

export async function processInboxTask(
  ctx: MutationCtx,
  args: {
    userId: string;
    task: Doc<"tasks">;
    action: InboxProcessingAction;
  },
): Promise<InboxProcessingResult> {
  if (args.action.type === "create_thread") {
    await requireOwned(ctx, "areas", {
      userId: args.userId,
      id: args.action.areaId,
    });

    const title = requireTitle(args.action.title, "Thread title");

    const nextOrder = await getNextOrder(ctx, "threads", args.userId);
    const slug = generateSlug(title);

    const thread: Omit<Doc<"threads">, "_id" | "_creationTime"> = {
      userId: args.userId,
      title,
      slug,
      areaId: args.action.areaId,
      order: nextOrder,
      state: "open",
      createdAt: Date.now(),
    };

    if (args.action.summary) {
      thread.summary = args.action.summary;
    }

    const threadId = await ctx.db.insert("threads", thread);

    await copyTaskToActivityLog(ctx, {
      userId: args.userId,
      task: args.task,
      threadId,
    });
    await ctx.db.delete(args.task._id);
    return { type: "created", slug };
  }

  if (args.action.type === "add_activity_log_entry") {
    const thread = await requireOwned(ctx, "threads", {
      userId: args.userId,
      id: args.action.threadId,
    });

    await copyTaskToActivityLog(ctx, {
      userId: args.userId,
      task: args.task,
      threadId: thread._id,
    });
    await ctx.db.delete(args.task._id);
    return { type: "added" };
  }

  if (args.action.type === "set_next_move") {
    const thread = await requireOwned(ctx, "threads", {
      userId: args.userId,
      id: args.action.threadId,
    });

    await applyThreadPatch(ctx, {
      userId: args.userId,
      thread,
      patch: { nextMove: args.task.text },
    });
    await ctx.db.delete(args.task._id);
    return { type: "set_next_move" };
  }

  if (args.action.type === "append_up_next") {
    const thread = await requireOwned(ctx, "threads", {
      userId: args.userId,
      id: args.action.threadId,
    });

    // The Task joins the back of the line and nothing is logged — lining up a
    // move is an edit, not an event. The only entry that can come out of this
    // is the invariant's: an empty Next Move slot takes the front move.
    await applyThreadPatch(ctx, {
      userId: args.userId,
      thread,
      patch: {
        upNext: storedUpNext([...(thread.upNext ?? []), args.task.text]),
      },
    });
    await ctx.db.delete(args.task._id);
    return { type: "appended_up_next" };
  }

  await ctx.db.delete(args.task._id);
  return { type: "discarded" };
}

async function copyTaskToActivityLog(
  ctx: MutationCtx,
  args: {
    userId: string;
    task: Doc<"tasks">;
    threadId: Id<"threads">;
  },
): Promise<void> {
  const note = buildThreadNoteFromTask(args.task);
  await recordActivity(ctx, {
    userId: args.userId,
    threadId: args.threadId,
    entry: note,
    createdAt: Date.now(),
  });
}
