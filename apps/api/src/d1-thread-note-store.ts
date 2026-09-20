import type {
  CommandAcknowledgement,
  PageRequest,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
  ThreadNotePage,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { requireNonBlankText } from "@vita-os/core";

import type { WorkerEnv } from "./env";
import type { ThreadNoteRow } from "./rows";
import type {
  Actored,
  StoreClock,
  StoreResult,
  ThreadNoteStore,
} from "./store";

import { doneBoundary } from "./d1-note-store";
import { doneCursor } from "./page-cursor";
import { THREAD_NOTE_COLUMNS, toThreadNote } from "./rows";
import { found, notFound } from "./store";

/**
 * Notes captured inside one Thread, and owned by it.
 *
 * Distinct from Standalone Notes: a Thread Note has no Attention Date of its own,
 * because the Thread it belongs to already carries the attention. Capturing one
 * counts as Thread activity, so the Thread's activity stamp moves with it.
 */
export class D1ThreadNoteStore implements ThreadNoteStore {
  constructor(
    private readonly database: WorkerEnv["DB"],
    private readonly clock: StoreClock,
  ) {}

  async listOpenThreadNotes(
    input: Actored<{ threadId: ThreadId }>,
  ): Promise<StoreResult<ThreadNote[]>> {
    if (!(await this.ownsThread(input.actorId, input.threadId)))
      return notFound;

    const result = await this.database
      .prepare(
        `SELECT ${THREAD_NOTE_COLUMNS}
         FROM thread_notes
         WHERE user_id = ? AND thread_id = ? AND state = 'open'
         ORDER BY created_at DESC, id DESC`,
      )
      .bind(input.actorId, input.threadId)
      .all<ThreadNoteRow>();

    return found(result.results.map(toThreadNote));
  }

  async getDoneThreadNotePage(
    input: Actored<{ threadId: ThreadId } & PageRequest>,
  ): Promise<StoreResult<ThreadNotePage>> {
    if (!(await this.ownsThread(input.actorId, input.threadId)))
      return notFound;

    const cursor =
      input.cursor === undefined ? undefined : doneCursor.decode(input.cursor);
    const boundary = doneBoundary(cursor);
    const result = await this.database
      .prepare(
        `SELECT ${THREAD_NOTE_COLUMNS}
         FROM thread_notes
         WHERE user_id = ? AND thread_id = ? AND state = 'done'${boundary.sql}
         ORDER BY completed_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(input.actorId, input.threadId, ...boundary.binds, input.limit + 1)
      .all<ThreadNoteRow>();

    const rows = result.results;
    const entries = rows.slice(0, input.limit).map(toThreadNote);
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

  /**
   * Capture a Note inside a Thread. The insert and the Thread's activity stamp
   * are one batch: the Dashboard's recent-activity strip reads only the Thread,
   * so it must never disagree with what the Thread actually holds.
   *
   * The stamp clears the denormalized content: a captured Note is activity
   * without an Activity Log entry to quote.
   */
  async createThreadNote(
    input: Actored<{ threadId: ThreadId; body: string }>,
  ): Promise<StoreResult<ThreadNote>> {
    const body = requireNonBlankText(input.body, "Thread note body");
    const now = this.clock.now();

    const [insert] = await this.database.batch<ThreadNoteRow>([
      this.database
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
          this.clock.newId(),
          input.actorId,
          input.threadId,
          body,
          now,
          now,
          input.threadId,
          input.actorId,
        ),
      this.database
        .prepare(
          `UPDATE threads
           SET last_activity_at = ?, last_activity_content = NULL
           WHERE id = ? AND user_id = ?`,
        )
        .bind(now, input.threadId, input.actorId),
    ]);

    const row = insert.results.at(0);
    if (row === undefined) return notFound;

    return found(toThreadNote(row));
  }

  async updateThreadNoteBody(
    input: Actored<{ threadNoteId: ThreadNoteId; body: string }>,
  ): Promise<StoreResult<ThreadNote>> {
    return this.write(
      input.actorId,
      input.threadNoteId,
      "body = ?, updated_at = ?",
      [requireNonBlankText(input.body, "Thread note body"), this.clock.now()],
    );
  }

  async markThreadNoteDone(
    input: Actored<{ threadNoteId: ThreadNoteId }>,
  ): Promise<StoreResult<ThreadNote>> {
    return this.write(
      input.actorId,
      input.threadNoteId,
      "state = 'done', completed_at = ?",
      [this.clock.now()],
    );
  }

  async markThreadNoteOpen(
    input: Actored<{ threadNoteId: ThreadNoteId }>,
  ): Promise<StoreResult<ThreadNote>> {
    return this.write(
      input.actorId,
      input.threadNoteId,
      "state = 'open', completed_at = NULL",
      [],
    );
  }

  async removeThreadNote(
    input: Actored<{ threadNoteId: ThreadNoteId }>,
  ): Promise<StoreResult<CommandAcknowledgement>> {
    const removed = await this.database
      .prepare(
        "DELETE FROM thread_notes WHERE user_id = ? AND id = ? RETURNING id",
      )
      .bind(input.actorId, input.threadNoteId)
      .first<{ id: string }>();
    if (removed === null) return notFound;

    return found(commandAcknowledged);
  }

  private async ownsThread(
    actorId: string,
    threadId: string,
  ): Promise<boolean> {
    const thread = await this.database
      .prepare("SELECT id FROM threads WHERE user_id = ? AND id = ? LIMIT 1")
      .bind(actorId, threadId)
      .first<{ id: string }>();

    return thread !== null;
  }

  private async write(
    actorId: string,
    threadNoteId: string,
    assignments: string,
    binds: (string | number | null)[],
  ): Promise<StoreResult<ThreadNote>> {
    const row = await this.database
      .prepare(
        `UPDATE thread_notes
         SET ${assignments}
         WHERE user_id = ? AND id = ?
         RETURNING ${THREAD_NOTE_COLUMNS}`,
      )
      .bind(...binds, actorId, threadNoteId)
      .first<ThreadNoteRow>();
    if (row === null) return notFound;

    return found(toThreadNote(row));
  }
}
