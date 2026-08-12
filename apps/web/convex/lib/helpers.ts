import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";

import type { DataModel } from "../_generated/dataModel";

import { authComponent } from "../auth";

/** Throws when the caller is not authenticated. */
export async function getAuthUserId(
  ctx: GenericMutationCtx<DataModel>,
): Promise<string> {
  const user = await authComponent.getAuthUser(ctx);
  return String(user._id);
}

export async function safeGetAuthUserId(
  ctx: GenericQueryCtx<DataModel>,
): Promise<string | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return null;
  return String(user._id);
}

type OrderedTable = "areas" | "threads";

export async function getNextOrder(
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
  table: OrderedTable,
  userId: string,
): Promise<number> {
  const existing = await ctx.db
    .query(table)
    .withIndex("by_user_order", (q) => q.eq("userId", userId))
    .order("desc")
    .first();

  return existing ? existing.order + 1 : 0;
}
