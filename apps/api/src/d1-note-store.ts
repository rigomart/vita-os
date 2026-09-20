import type {
  CommandAcknowledgement,
  Note,
  NoteId,
  NotePage,
  PageRequest,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { requireNonBlankText } from "@vita-os/core";

import type { WorkerEnv } from "./env";
import type { NoteRow } from "./rows";
import type { Actored, NoteStore, StoreClock, StoreResult } from "./store";

import { doneCursor, type PageCursor } from "./page-cursor";
import { NOTE_COLUMNS, toNote } from "./rows";
import { found, notFound } from "./store";

/**
 * Standalone Notes: captured on their own, attached to no Thread.
 *
 * Open Notes are read whole — the Inbox is what the user has agreed to look at,
 * so they keep it small themselves. Done Notes only grow, so they are paged.
 */
export class D1NoteStore implements NoteStore {
  constructor(
    private readonly database: WorkerEnv["DB"],
    private readonly clock: StoreClock,
  ) {}

  async listOpenNotes(input: Actored): Promise<Note[]> {
    const result = await this.database
      .prepare(
        `SELECT ${NOTE_COLUMNS}
         FROM notes
         WHERE user_id = ? AND state = 'open'
         ORDER BY created_at DESC, id DESC`,
      )
      .bind(input.actorId)
      .all<NoteRow>();

    return result.results.map(toNote);
  }

  /**
   * How many Open Notes there are. Read from the same index the Inbox list reads,
   * so the navigation badge and the list itself cannot disagree.
   */
  async countOpenNotes(input: Actored): Promise<number> {
    const row = await this.database
      .prepare(
        "SELECT COUNT(*) AS total FROM notes WHERE user_id = ? AND state = 'open'",
      )
      .bind(input.actorId)
      .first<{ total: number }>();

    return row?.total ?? 0;
  }

  async getDoneNotePage(
    input: Actored<PageRequest>,
  ): Promise<StoreResult<NotePage>> {
    const cursor =
      input.cursor === undefined ? undefined : doneCursor.decode(input.cursor);
    const boundary = doneBoundary(cursor);
    const result = await this.database
      .prepare(
        `SELECT ${NOTE_COLUMNS}
         FROM notes
         WHERE user_id = ? AND state = 'done'${boundary.sql}
         ORDER BY completed_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(input.actorId, ...boundary.binds, input.limit + 1)
      .all<NoteRow>();

    const rows = result.results;
    const entries = rows.slice(0, input.limit).map(toNote);
    const lastEntry = entries.at(-1);

    return found({
      entries,
      ...(rows.length <= input.limit || lastEntry === undefined
        ? {}
        : {
            nextCursor: doneCursor.encode({
              at: lastEntry.completedAt ?? null,
              id: lastEntry._id,
            }),
          }),
    });
  }

  async createNote(
    input: Actored<{ body: string; when?: number }>,
  ): Promise<StoreResult<Note>> {
    const body = requireNonBlankText(input.body, "Note body");
    const now = this.clock.now();
    const row = await this.database
      .prepare(
        `INSERT INTO notes (
           id, user_id, body, attention_date, state, completed_at, created_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, 'open', NULL, ?, ?)
         RETURNING ${NOTE_COLUMNS}`,
      )
      .bind(
        this.clock.newId(),
        input.actorId,
        body,
        input.when ?? null,
        now,
        now,
      )
      .first<NoteRow>();
    if (row === null) return notFound;

    return found(toNote(row));
  }

  async updateNoteBody(
    input: Actored<{ noteId: NoteId; body: string }>,
  ): Promise<StoreResult<Note>> {
    return this.write(input.actorId, input.noteId, "body = ?, updated_at = ?", [
      requireNonBlankText(input.body, "Note body"),
      this.clock.now(),
    ]);
  }

  async updateNoteAttentionDate(
    input: Actored<{ noteId: NoteId; when: number | null }>,
  ): Promise<StoreResult<Note>> {
    return this.write(
      input.actorId,
      input.noteId,
      "attention_date = ?, updated_at = ?",
      [input.when, this.clock.now()],
    );
  }

  async markNoteDone(
    input: Actored<{ noteId: NoteId }>,
  ): Promise<StoreResult<Note>> {
    const now = this.clock.now();
    return this.write(
      input.actorId,
      input.noteId,
      "state = 'done', completed_at = ?, updated_at = ?",
      [now, now],
    );
  }

  /** Reopening forgets the completion, exactly as it did before. */
  async markNoteOpen(
    input: Actored<{ noteId: NoteId }>,
  ): Promise<StoreResult<Note>> {
    return this.write(
      input.actorId,
      input.noteId,
      "state = 'open', completed_at = NULL, updated_at = ?",
      [this.clock.now()],
    );
  }

  async removeNote(
    input: Actored<{ noteId: NoteId }>,
  ): Promise<StoreResult<CommandAcknowledgement>> {
    const removed = await this.database
      .prepare("DELETE FROM notes WHERE user_id = ? AND id = ? RETURNING id")
      .bind(input.actorId, input.noteId)
      .first<{ id: string }>();
    if (removed === null) return notFound;

    return found(commandAcknowledged);
  }

  private async write(
    actorId: string,
    noteId: string,
    assignments: string,
    binds: (string | number | null)[],
  ): Promise<StoreResult<Note>> {
    const row = await this.database
      .prepare(
        `UPDATE notes
         SET ${assignments}
         WHERE user_id = ? AND id = ?
         RETURNING ${NOTE_COLUMNS}`,
      )
      .bind(...binds, actorId, noteId)
      .first<NoteRow>();
    if (row === null) return notFound;

    return found(toNote(row));
  }
}

/**
 * Where the next page of Done records starts.
 *
 * Completion times sort newest first, and a record imported without one sorts
 * last — SQLite orders NULL below every number, which is where an unknown
 * completion belongs. Once a page has crossed into those records, only their IDs
 * continue the read.
 */
export function doneBoundary(cursor: PageCursor | undefined): {
  sql: string;
  binds: (string | number | null)[];
} {
  if (cursor === undefined) return { sql: "", binds: [] };

  if (cursor.at === null) {
    return { sql: " AND completed_at IS NULL AND id < ?", binds: [cursor.id] };
  }

  return {
    sql:
      " AND (completed_at IS NULL OR completed_at < ?" +
      " OR (completed_at = ? AND id < ?))",
    binds: [cursor.at, cursor.at, cursor.id],
  };
}
