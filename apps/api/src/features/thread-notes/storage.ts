import type {
  PageRequest,
  ThreadNote,
  ThreadNotePage,
} from "@vita-os/contracts";

import type { SqlValue } from "../../platform/d1/statements";
import type { RequestScope } from "../../platform/request-scope";
import type { ThreadNoteRow } from "./rows";

import {
  doneCursor,
  pageBoundary,
  toPage,
} from "../../platform/d1/page-cursor";
import { setClause } from "../../platform/d1/statements";
import { THREAD_NOTE_COLUMNS, toThreadNote } from "./rows";

/**
 * Notes captured inside one Thread, and owned by it. One D1 round trip per
 * function, every statement scoped by the owner.
 *
 * Distinct from Standalone Notes: a Thread Note has no Attention Date of its own,
 * because the Thread it belongs to already carries the attention. Capturing one
 * counts as Thread activity, so the Thread's activity stamp moves with it.
 */
export function threadNoteStorage({ db, clock, actorId }: RequestScope) {
  /**
   * Change one Thread Note. `null` means it is missing or is not theirs, which
   * are the same answer.
   */
  async function update(
    threadNoteId: string,
    columns: Record<string, SqlValue>,
  ): Promise<ThreadNote | null> {
    const set = setClause(columns);
    const row = await db
      .prepare(
        `UPDATE thread_notes
         SET ${set.sql}
         WHERE user_id = ? AND id = ?
         RETURNING ${THREAD_NOTE_COLUMNS}`,
      )
      .bind(...set.binds, actorId, threadNoteId)
      .first<ThreadNoteRow>();

    return row === null ? null : toThreadNote(row);
  }

  return {
    async listOpen(threadId: string): Promise<ThreadNote[]> {
      const result = await db
        .prepare(
          `SELECT ${THREAD_NOTE_COLUMNS}
           FROM thread_notes
           WHERE user_id = ? AND thread_id = ? AND state = 'open'
           ORDER BY created_at DESC, id DESC`,
        )
        .bind(actorId, threadId)
        .all<ThreadNoteRow>();

      return result.results.map(toThreadNote);
    },

    /** Throws when the cursor is not one this Worker minted. */
    async readDonePage(
      threadId: string,
      page: PageRequest,
    ): Promise<ThreadNotePage> {
      const cursor =
        page.cursor === undefined ? undefined : doneCursor.decode(page.cursor);
      const boundary = pageBoundary("completed_at", cursor);
      const result = await db
        .prepare(
          `SELECT ${THREAD_NOTE_COLUMNS}
           FROM thread_notes
           WHERE user_id = ? AND thread_id = ? AND state = 'done'${boundary.sql}
           ORDER BY completed_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(actorId, threadId, ...boundary.binds, page.limit + 1)
        .all<ThreadNoteRow>();

      return toPage(result.results, page.limit, {
        toEntry: toThreadNote,
        cursorFor: (note) => ({ at: note.completedAt ?? null, id: note._id }),
        codec: doneCursor,
      });
    },

    /**
     * Capture a Note inside a Thread. The insert and the Thread's activity
     * stamp are one batch: the Dashboard's recent-activity strip reads only the
     * Thread, so it must never disagree with what the Thread actually holds.
     *
     * The stamp clears the denormalized content: a captured Note is activity
     * without an Activity Log entry to quote. `null` means the Thread is missing
     * or is not theirs.
     */
    async insert(threadId: string, body: string): Promise<ThreadNote | null> {
      const now = clock.now();
      const [insert] = await db.batch<ThreadNoteRow>([
        db
          .prepare(
            `INSERT INTO thread_notes (
               id, user_id, thread_id, body, state, completed_at, created_at,
               updated_at
             )
             SELECT ?, ?, ?, ?, 'open', NULL, ?, ?
             WHERE EXISTS (SELECT 1 FROM threads WHERE id = ? AND user_id = ?)
             RETURNING ${THREAD_NOTE_COLUMNS}`,
          )
          .bind(
            clock.newId(),
            actorId,
            threadId,
            body,
            now,
            now,
            threadId,
            actorId,
          ),
        db
          .prepare(
            `UPDATE threads
             SET last_activity_at = ?, last_activity_content = NULL
             WHERE id = ? AND user_id = ?`,
          )
          .bind(now, threadId, actorId),
      ]);

      const row = insert.results.at(0);
      return row === undefined ? null : toThreadNote(row);
    },

    setBody(threadNoteId: string, body: string): Promise<ThreadNote | null> {
      return update(threadNoteId, { body, updated_at: clock.now() });
    },

    /** Completing and reopening leave the last-edited time alone. */
    markDone(threadNoteId: string): Promise<ThreadNote | null> {
      return update(threadNoteId, { state: "done", completed_at: clock.now() });
    },

    markOpen(threadNoteId: string): Promise<ThreadNote | null> {
      return update(threadNoteId, { state: "open", completed_at: null });
    },

    async remove(threadNoteId: string): Promise<boolean> {
      const removed = await db
        .prepare(
          "DELETE FROM thread_notes WHERE user_id = ? AND id = ? RETURNING id",
        )
        .bind(actorId, threadNoteId)
        .first<{ id: string }>();

      return removed !== null;
    },
  };
}
