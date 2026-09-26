import type { ActivityLogPage, PageRequest } from "@vita-os/contracts";

import type { RequestScope } from "../../platform/request-scope";
import type { ActivityRow } from "./rows";

import {
  createPageCursorCodec,
  pageBoundary,
  toPage,
} from "../../platform/d1/page-cursor";
import { invalidActivityPagination } from "./errors";
import { ACTIVITY_COLUMNS, toActivityLogEntry } from "./rows";

/** The Activity Log reads by entry creation time. */
const activityCursor = createPageCursorCodec("createdAt", {
  refusal: invalidActivityPagination,
});

/**
 * One Thread's Activity Log, newest first.
 *
 * Entries are written only as part of a Thread change, in the Thread's own
 * batch; this is the read side. A cursor the Worker did not mint throws before
 * anything is read.
 */
export function activityLogStorage({ db, actorId }: RequestScope) {
  return {
    async readPage(
      threadId: string,
      page: PageRequest,
    ): Promise<ActivityLogPage> {
      const cursor =
        page.cursor === undefined
          ? undefined
          : activityCursor.decode(page.cursor);
      const boundary = pageBoundary("created_at", cursor);
      const result = await db
        .prepare(
          `SELECT ${ACTIVITY_COLUMNS}
           FROM activity_log_entries
           WHERE user_id = ? AND thread_id = ?${boundary.sql}
           ORDER BY created_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(actorId, threadId, ...boundary.binds, page.limit + 1)
        .all<ActivityRow>();

      return toPage(result.results, page.limit, {
        toEntry: toActivityLogEntry,
        cursorFor: (entry) => ({ at: entry.createdAt, id: entry._id }),
        codec: activityCursor,
      });
    },
  };
}
