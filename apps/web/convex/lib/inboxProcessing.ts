import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { getAreaForUser } from "./areaProjects";
import { getNextOrder } from "./helpers";
import { generateSlug } from "./slugs";

type MutationCtx = GenericMutationCtx<DataModel>;

export type InboxProcessingAction =
  | {
      type: "create_project";
      name: string;
      areaId: Id<"areas">;
      definitionOfDone?: string;
    }
  | { type: "add_to_project"; projectId: Id<"projects"> }
  | { type: "set_next_action"; projectId: Id<"projects"> }
  | { type: "discard" };

export type InboxProcessingResult =
  | { type: "created"; slug: string }
  | { type: "added" }
  | { type: "set_next_action" }
  | { type: "discarded" };

export type ItemProcessingDisposition = "keep_item" | "delete_item";

export function getItemProcessingDisposition(
  _action: InboxProcessingAction,
): ItemProcessingDisposition {
  return "delete_item";
}

export function getInboxProcessingResultType(
  action: InboxProcessingAction,
): InboxProcessingResult["type"] {
  if (action.type === "create_project") return "created";
  if (action.type === "add_to_project") return "added";
  if (action.type === "set_next_action") return "set_next_action";
  return "discarded";
}

export function buildProjectNoteFromItem(item: Doc<"items">): {
  type: "note";
  content: string;
} {
  return { type: "note", content: item.text };
}

export async function processInboxItem(
  ctx: MutationCtx,
  args: {
    userId: string;
    item: Doc<"items">;
    action: InboxProcessingAction;
  },
): Promise<InboxProcessingResult> {
  if (args.action.type === "create_project") {
    await getAreaForUser(ctx, {
      userId: args.userId,
      areaId: args.action.areaId,
    });

    const nextOrder = await getNextOrder(ctx, "projects", args.userId);
    const slug = generateSlug(args.action.name);

    const projectId = await ctx.db.insert("projects", {
      userId: args.userId,
      name: args.action.name,
      slug,
      definitionOfDone: args.action.definitionOfDone,
      areaId: args.action.areaId,
      order: nextOrder,
      state: "active",
      createdAt: Date.now(),
    });

    await copyItemToProjectLog(ctx, {
      userId: args.userId,
      item: args.item,
      projectId,
    });
    await ctx.db.delete(args.item._id);
    return { type: "created", slug };
  }

  if (args.action.type === "add_to_project") {
    const project = await getProjectForProcessing(ctx, {
      userId: args.userId,
      projectId: args.action.projectId,
    });

    await copyItemToProjectLog(ctx, {
      userId: args.userId,
      item: args.item,
      projectId: project._id,
    });
    await ctx.db.delete(args.item._id);
    return { type: "added" };
  }

  if (args.action.type === "set_next_action") {
    const project = await getProjectForProcessing(ctx, {
      userId: args.userId,
      projectId: args.action.projectId,
    });

    await ctx.db.patch(project._id, { nextMove: args.item.text });
    await ctx.db.delete(args.item._id);
    return { type: "set_next_action" };
  }

  await ctx.db.delete(args.item._id);
  return { type: "discarded" };
}

async function getProjectForProcessing(
  ctx: MutationCtx,
  args: { userId: string; projectId: Id<"projects"> },
): Promise<Doc<"projects">> {
  const project = await ctx.db.get(args.projectId);
  if (!project || project.userId !== args.userId) {
    throw new Error("Project not found");
  }
  return project;
}

async function copyItemToProjectLog(
  ctx: MutationCtx,
  args: {
    userId: string;
    item: Doc<"items">;
    projectId: Id<"projects">;
  },
): Promise<void> {
  const note = buildProjectNoteFromItem(args.item);
  await ctx.db.insert("projectLogs", {
    userId: args.userId,
    projectId: args.projectId,
    type: note.type,
    content: note.content,
    createdAt: Date.now(),
  });
}
