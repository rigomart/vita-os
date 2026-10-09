import type { ActivityLogPage, PageRequest } from "@vita-os/contracts";

import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { RequestScope } from "../../platform/request-scope";

import {
  createPageCursorCodec,
  pageBoundary,
  toPage,
} from "../../platform/d1/page-cursor";
import { activityLogEntries } from "../../platform/d1/schema";
import { invalidActivityPagination } from "./errors";
import { ACTIVITY_FIELDS, toActivityLogEntry } from "./rows";

/** The Activity Log reads by entry creation time. */
const activityCursor = createPageCursorCodec("createdAt", {
  refusal: invalidActivityPagination.message,
});

/** One Thread's Activity Log, newest first, in one owner-scoped statement. */
export function activityLogStorage({ db, actorId }: RequestScope) {
  const database = drizzle(db);
  return {
    async readPage(
      threadId: string,
      page: PageRequest,
    ): Promise<ActivityLogPage> {
      const cursor =
        page.cursor === undefined
          ? undefined
          : activityCursor.decode(page.cursor);
      const rows = await database
        .select(ACTIVITY_FIELDS)
        .from(activityLogEntries)
        .where(
          and(
            eq(activityLogEntries.user_id, actorId),
            eq(activityLogEntries.thread_id, threadId),
            pageBoundary(
              activityLogEntries.created_at,
              activityLogEntries.id,
              cursor,
            ),
          ),
        )
        .orderBy(
          desc(activityLogEntries.created_at),
          desc(activityLogEntries.id),
        )
        .limit(page.limit + 1);
      return toPage(rows, page.limit, {
        toEntry: toActivityLogEntry,
        cursorFor: (entry) => ({ at: entry.createdAt, id: entry._id }),
        codec: activityCursor,
      });
    },
  };
}
