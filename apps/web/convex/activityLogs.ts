import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

import type { ProjectedActivityLog } from "./lib/validators";

import { query } from "./_generated/server";
import { safeGetAuthUserId } from "./lib/helpers";
import { getOwned } from "./lib/ownedAccess";
import { emptyPage } from "./lib/pagination";
import {
  projectActivityLog,
  projectedActivityLogValidator,
} from "./lib/validators";

/**
 * One Thread's automatic Activity Log, newest first, one page at a time.
 *
 * A Thread's history only grows, so it is paginated: the caller decides how
 * far back to read instead of the server handing over every entry. Legacy
 * manual notes are hidden immediately while their migration is still running.
 */
export const listByThread = query({
  args: {
    threadId: v.id("threads"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(projectedActivityLogValidator),
  handler: async (ctx, args) => {
    const userId = await safeGetAuthUserId(ctx);
    if (!userId) return emptyPage<ProjectedActivityLog>();

    const thread = await getOwned(ctx, "threads", {
      userId,
      id: args.threadId,
    });
    if (!thread) return emptyPage<ProjectedActivityLog>();

    const page = await ctx.db
      .query("activityLogs")
      .withIndex("by_user_thread", (q) =>
        q.eq("userId", userId).eq("threadId", thread._id),
      )
      .filter((q) => q.neq(q.field("type"), "note"))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...page, page: page.page.map(projectActivityLog) };
  },
});
