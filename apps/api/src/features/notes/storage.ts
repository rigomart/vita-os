import type { Note, NotePage, PageRequest } from "@vita-os/contracts";

import type { SqlValue } from "../../platform/d1/statements";
import type { RequestScope } from "../../platform/request-scope";
import type { NoteRow } from "./rows";

import {
  doneCursor,
  pageBoundary,
  toPage,
} from "../../platform/d1/page-cursor";
import { setClause } from "../../platform/d1/statements";
import { NOTE_COLUMNS, toNote } from "./rows";

/**
 * Standalone Notes: captured on their own, attached to no Thread. One D1 round
 * trip per function, every statement scoped by the owner.
 *
 * Open Notes are read whole — they are what the person has agreed to look at, so
 * they keep the collection small themselves. Done Notes only grow, so they are
 * paged.
 */
export function noteStorage({ db, clock, actorId }: RequestScope) {
  /**
   * Change one Note. The owner is part of the statement, and the row comes back
   * from the same statement that changed it; `null` means the Note is missing
   * or is not theirs, which are the same answer.
   */
  async function update(
    noteId: string,
    columns: Record<string, SqlValue>,
  ): Promise<Note | null> {
    const set = setClause(columns);
    const row = await db
      .prepare(
        `UPDATE notes
         SET ${set.sql}
         WHERE user_id = ? AND id = ?
         RETURNING ${NOTE_COLUMNS}`,
      )
      .bind(...set.binds, actorId, noteId)
      .first<NoteRow>();

    return row === null ? null : toNote(row);
  }

  return {
    async listOpen(): Promise<Note[]> {
      const result = await db
        .prepare(
          `SELECT ${NOTE_COLUMNS}
           FROM notes
           WHERE user_id = ? AND state = 'open'
           ORDER BY created_at DESC, id DESC`,
        )
        .bind(actorId)
        .all<NoteRow>();

      return result.results.map(toNote);
    },

    /**
     * How many Open Notes there are. Read from the same index the collection
     * reads, so the navigation badge and the collection cannot disagree.
     */
    async countOpen(): Promise<number> {
      const row = await db
        .prepare(
          "SELECT COUNT(*) AS total FROM notes WHERE user_id = ? AND state = 'open'",
        )
        .bind(actorId)
        .first<{ total: number }>();

      return row?.total ?? 0;
    },

    /** Throws when the cursor is not one this Worker minted. */
    async readDonePage(page: PageRequest): Promise<NotePage> {
      const cursor =
        page.cursor === undefined ? undefined : doneCursor.decode(page.cursor);
      const boundary = pageBoundary("completed_at", cursor);
      const result = await db
        .prepare(
          `SELECT ${NOTE_COLUMNS}
           FROM notes
           WHERE user_id = ? AND state = 'done'${boundary.sql}
           ORDER BY completed_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(actorId, ...boundary.binds, page.limit + 1)
        .all<NoteRow>();

      return toPage(result.results, page.limit, {
        toEntry: toNote,
        cursorFor: (note) => ({ at: note.completedAt ?? null, id: note._id }),
        codec: doneCursor,
      });
    },

    async insert(note: {
      body: string;
      attentionDate?: number;
    }): Promise<Note | null> {
      const now = clock.now();
      const row = await db
        .prepare(
          `INSERT INTO notes (
             id, user_id, body, attention_date, state, completed_at, created_at,
             updated_at
           )
           VALUES (?, ?, ?, ?, 'open', NULL, ?, ?)
           RETURNING ${NOTE_COLUMNS}`,
        )
        .bind(
          clock.newId(),
          actorId,
          note.body,
          note.attentionDate ?? null,
          now,
          now,
        )
        .first<NoteRow>();

      return row === null ? null : toNote(row);
    },

    setBody(noteId: string, body: string): Promise<Note | null> {
      return update(noteId, { body, updated_at: clock.now() });
    },

    setAttentionDate(
      noteId: string,
      attentionDate: number | null,
    ): Promise<Note | null> {
      return update(noteId, {
        attention_date: attentionDate,
        updated_at: clock.now(),
      });
    },

    markDone(noteId: string): Promise<Note | null> {
      const now = clock.now();
      return update(noteId, {
        state: "done",
        completed_at: now,
        updated_at: now,
      });
    },

    /** Reopening forgets the completion. */
    markOpen(noteId: string): Promise<Note | null> {
      return update(noteId, {
        state: "open",
        completed_at: null,
        updated_at: clock.now(),
      });
    },

    async remove(noteId: string): Promise<boolean> {
      const removed = await db
        .prepare("DELETE FROM notes WHERE user_id = ? AND id = ? RETURNING id")
        .bind(actorId, noteId)
        .first<{ id: string }>();

      return removed !== null;
    },
  };
}
