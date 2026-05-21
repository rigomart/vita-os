import type { GenericMutationCtx } from "convex/server";

import type { DataModel, Doc, Id } from "../_generated/dataModel";

type MutationCtx = GenericMutationCtx<DataModel>;

export function areaBelongsToUser(
  area: Doc<"areas"> | null,
  userId: string,
): area is Doc<"areas"> {
  return area !== null && area.userId === userId;
}

export function getAreaDeletionBlocker(
  threads: Array<Doc<"threads">>,
): Doc<"threads"> | null {
  return threads[0] ?? null;
}

export async function getAreaForUser(
  ctx: MutationCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<Doc<"areas">> {
  const area = await ctx.db.get(args.areaId);
  if (!areaBelongsToUser(area, args.userId)) {
    throw new Error("Area not found");
  }
  return area;
}

export async function listThreadsInAreaForUser(
  ctx: MutationCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<Array<Doc<"threads">>> {
  const threads = await ctx.db
    .query("threads")
    .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
    .collect();

  return threads.filter((thread) => thread.userId === args.userId);
}

export async function assertAreaCanBeDeleted(
  ctx: MutationCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<void> {
  const threads = await listThreadsInAreaForUser(ctx, args);
  if (getAreaDeletionBlocker(threads)) {
    throw new Error(
      "Cannot delete an area that has threads. Move or delete the threads first.",
    );
  }
}
