import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";

import type { DataModel, Doc, Id } from "../_generated/dataModel";

type ReadCtx = GenericMutationCtx<DataModel> | GenericQueryCtx<DataModel>;

export function getAreaDeletionBlocker(
  threads: Array<Doc<"threads">>,
): Doc<"threads"> | null {
  return threads[0] ?? null;
}

/**
 * Threads filed under an Area, restricted to one owner.
 *
 * The `by_area` index is not user-scoped, so unlike a read through
 * `ownedAccess` this one has to drop foreign Threads itself.
 */
export async function listThreadsInAreaForUser(
  ctx: ReadCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<Array<Doc<"threads">>> {
  const threads = await ctx.db
    .query("threads")
    .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
    .collect();

  return threads.filter((thread) => thread.userId === args.userId);
}

export async function assertAreaCanBeDeleted(
  ctx: ReadCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<void> {
  const threads = await listThreadsInAreaForUser(ctx, args);
  if (getAreaDeletionBlocker(threads)) {
    throw new Error(
      "Cannot delete an area that has threads. Move or delete the threads first.",
    );
  }
}
