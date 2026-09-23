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

import { updateOwnedRecord } from "./d1-owned-record";
import { doneCursor, pageBoundary, toPage } from "./page-cursor";
import { NOTE_COLUMNS, toNote } from "./rows";
import { found, notFound } from "./store";

/**
 * Standalone Notes: captured on their own, attached to no Thread.
 *
 * Open Notes are read whole — they are what the person has agreed to look at, so
 * they keep the collection small themselves. Done Notes only grow, so they are
 * paged.
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
   * How many Open Notes there are. Read from the same index the collection reads,
   * so the navigation badge and the collection itself cannot disagree.
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
    const boundary = pageBoundary("completed_at", cursor);
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

    return found(
      toPage(result.results, input.limit, {
        toEntry: toNote,
        cursorFor: (note) => ({ at: note.completedAt ?? null, id: note._id }),
        codec: doneCursor,
      }),
    );
  }

  async createNote(
    input: Actored<{ body: string; attentionDate?: number }>,
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
        input.attentionDate ?? null,
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
    input: Actored<{ noteId: NoteId; attentionDate: number | null }>,
  ): Promise<StoreResult<Note>> {
    return this.write(
      input.actorId,
      input.noteId,
      "attention_date = ?, updated_at = ?",
      [input.attentionDate, this.clock.now()],
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

  private write(
    actorId: string,
    noteId: string,
    assignments: string,
    binds: (string | number | null)[],
  ): Promise<StoreResult<Note>> {
    return updateOwnedRecord<NoteRow, Note>(this.database, {
      table: "notes",
      columns: NOTE_COLUMNS,
      assignments,
      binds,
      actorId,
      id: noteId,
      toValue: toNote,
    });
  }
}
