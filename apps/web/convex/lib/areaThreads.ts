import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";

import type { DataModel, Doc, Id } from "../_generated/dataModel";

type ReadCtx = GenericMutationCtx<DataModel> | GenericQueryCtx<DataModel>;

/**
 * Open Threads filed under an Area, in creation order.
 *
 * The `by_user_area_state` index carries the owner, so this reads exactly the
 * caller's Open Threads in that Area — no ownership or state filtering in JS,
 * and no scan of Threads belonging to anyone else.
 */
export async function listOpenThreadsInAreaForUser(
  ctx: ReadCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<Array<Doc<"threads">>> {
  return ctx.db
    .query("threads")
    .withIndex("by_user_area_state", (q) =>
      q.eq("userId", args.userId).eq("areaId", args.areaId).eq("state", "open"),
    )
    .collect();
}

/**
 * The Thread that stops an Area from being deleted, or `null` when the Area
 * is empty. Threads of any state block deletion, so this reads the index
 * range for the Area without pinning `state`, and stops at the first hit.
 */
export async function findAreaDeletionBlocker(
  ctx: ReadCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<Doc<"threads"> | null> {
  return ctx.db
    .query("threads")
    .withIndex("by_user_area_state", (q) =>
      q.eq("userId", args.userId).eq("areaId", args.areaId),
    )
    .first();
}

export async function assertAreaCanBeDeleted(
  ctx: ReadCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<void> {
  if (await findAreaDeletionBlocker(ctx, args)) {
    throw new Error(
      "Cannot delete an area that has threads. Move or delete the threads first.",
    );
  }
}
