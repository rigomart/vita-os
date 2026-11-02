import type { ActivityLogPage, PageRequest } from "@vita-os/contracts";

import { buildNoteAddedLogEntry } from "@vita-os/core";
import { and, desc, eq, sql } from "drizzle-orm";

import type { RequestScope } from "../../platform/request-scope";

import {
  createPageCursorCodec,
  pageBoundary,
  toPage,
} from "../../platform/sqlite/page-cursor";
import { activityLogEntries, threadNotes } from "../../platform/sqlite/schema";
import { invalidActivityPagination } from "./errors";
import { ACTIVITY_FIELDS, toActivityLogEntry } from "./rows";

/** The Activity Log reads by entry creation time. */
const activityCursor = createPageCursorCodec("createdAt", {
  refusal: invalidActivityPagination.message,
});

/** One Thread's Activity Log, newest first, in one owner-scoped statement. */
export function activityLogStorage({ db, clock, actorId }: RequestScope) {
  const database = db.drizzle;
  return {
    /**
     * The `note_added` entry for a Thread Note, for a batch that writes the
     * Note before it. It reads the Note's row, so it writes one entry exactly
     * when the Note was written.
     */
    prepareNoteAdded(threadNoteId: string, at: number, startsThread = false) {
      const log = buildNoteAddedLogEntry(threadNoteId, startsThread);
      return database.insert(activityLogEntries).select(
        database
          .select({
            // INSERT SELECT follows the schema column order.
            id: sql<string>`${clock.newId()}`.as("id"),
            user_id: threadNotes.user_id,
            thread_id: threadNotes.thread_id,
            type: sql<typeof log.type>`${log.type}`.as("type"),
            content: sql<string>`${log.content}`.as("content"),
            previous_value: sql<null>`NULL`.as("previous_value"),
            new_value: sql<null>`NULL`.as("new_value"),
            created_at: sql<number>`${at}`.as("created_at"),
            thread_note_id: threadNotes.id,
          })
          .from(threadNotes)
          .where(
            and(
              eq(threadNotes.id, threadNoteId),
              eq(threadNotes.user_id, actorId),
            ),
          ),
      );
    },

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
