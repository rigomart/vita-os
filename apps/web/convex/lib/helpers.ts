import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { authComponent } from "../auth";

/**
 * Get the authenticated user's ID (throws if not authenticated).
 * Use in mutations.
 */
export async function getAuthUserId(
  ctx: GenericMutationCtx<DataModel>,
): Promise<string> {
  const user = await authComponent.getAuthUser(ctx);
  return String(user._id);
}

/**
 * Get the authenticated user's ID or null.
 * Use in queries.
 */
export async function safeGetAuthUserId(
  ctx: GenericQueryCtx<DataModel>,
): Promise<string | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return null;
  return String(user._id);
}

type OrderedTable = "areas" | "projects";

/**
 * Get the next order value for a table with a by_user_order index.
 */
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
