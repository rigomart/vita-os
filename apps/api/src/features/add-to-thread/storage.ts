import type { Note, NoteAddedToThread } from "@vita-os/contracts";

import type { SqlCondition } from "../../platform/d1/statements";
import type { RequestScope } from "../../platform/request-scope";
import type { ThreadNoteRow } from "../thread-notes/rows";
import type { ThreadRow } from "../threads/rows";
import type {
  NewThread,
  PreparedThreadChange,
  ThreadChange,
} from "../threads/storage";

import { THREAD_NOTE_COLUMNS, toThreadNote } from "../thread-notes/rows";
import { threadStorage } from "../threads/storage";

/**
 * A Standalone Note becoming a Thread Note, one D1 batch per function.
 *
 * D1 has no interactive transactions (ADR 0019), so every write is guarded by
 * what the operation read, and each later statement depends on the one before
 * it having written:
 *
 * 1. The Thread write — a change on an existing Thread, or the insert of a new
 *    one followed by its first change — happens only while the Note is still
 *    open with the date the decision read. The change stamps a fresh token.
 * 2. The Note is copied into `thread_notes` only from the Thread row carrying
 *    that token, keeping its body and creation time.
 * 3. The Note is deleted only when its copy exists.
 *
 * A missing, foreign, or Done Note, a resolved or foreign Thread, or a lost
 * race therefore writes nothing at all — no Thread change, no Activity Log
 * entry, no copy, no deletion — and the batch answers `null`.
 */
export function addToThreadStorage(scope: RequestScope) {
  const { db, clock, actorId } = scope;
  const threads = threadStorage(scope);

  /**
   * The Note as the decision read it: still open, with the same date and body,
   * so the Task named from its first line matches the body that is copied.
   */
  function noteUnchanged(note: Note): SqlCondition {
    return {
      sql: `EXISTS (
              SELECT 1 FROM notes
              WHERE id = ? AND user_id = ? AND state = 'open'
                AND attention_date IS ? AND body = ?
            )`,
      binds: [note._id, actorId, note.followUp ?? null, note.body],
    };
  }

  /** Copy the Note and remove it, both behind the Thread change. */
  function copyAndRemoveNote(
    note: Note,
    threadId: string,
    change: PreparedThreadChange,
  ): D1PreparedStatement[] {
    const threadNoteId = clock.newId();
    return [
      db
        .prepare(
          `INSERT INTO thread_notes (
             id, user_id, thread_id, body, state, completed_at, created_at,
             updated_at
           )
           SELECT ?, user_id, ?, body, 'open', NULL, created_at,
                  COALESCE(updated_at, created_at)
           FROM notes
           WHERE id = ? AND user_id = ? AND state = 'open'
             AND EXISTS (
               SELECT 1 FROM threads
               WHERE id = ? AND user_id = ? AND last_change_token = ?
             )
           RETURNING ${THREAD_NOTE_COLUMNS}`,
        )
        .bind(
          threadNoteId,
          threadId,
          note._id,
          actorId,
          threadId,
          actorId,
          change.changeToken,
        ),
      db
        .prepare(
          `DELETE FROM notes
           WHERE id = ? AND user_id = ?
             AND EXISTS (
               SELECT 1 FROM thread_notes WHERE id = ? AND user_id = ?
             )`,
        )
        .bind(note._id, actorId, threadNoteId, actorId),
    ];
  }

  async function write(
    leading: D1PreparedStatement[],
    change: PreparedThreadChange,
    note: Note,
    threadId: string,
  ): Promise<NoteAddedToThread | null> {
    const results = await db.batch<ThreadRow | ThreadNoteRow>([
      ...leading,
      ...change.statements,
      ...copyAndRemoveNote(note, threadId, change),
    ]);
    const changeResults = results.slice(
      leading.length,
      leading.length + change.statements.length,
    ) as D1Result<ThreadRow>[];
    const [copy, removal] = results.slice(
      leading.length + change.statements.length,
    ) as [D1Result<ThreadNoteRow>, D1Result];

    const thread = change.settle(changeResults);
    if (thread === null) return null;

    const threadNote = copy.results.at(0);
    if (threadNote === undefined || removal.meta.changes !== 1) {
      throw new Error("Adding a Note to a Thread wrote an inconsistent batch");
    }
    return { thread, threadNote: toThreadNote(threadNote) };
  }

  return {
    /**
     * Add the Note to an existing Open Thread, with the change decided against
     * the Thread at `expectedRevision`. The change always stamps the Thread's
     * activity, as capturing a Thread Note does.
     */
    addToThread(input: {
      note: Note;
      threadId: string;
      expectedRevision: number;
      change: ThreadChange;
    }): Promise<NoteAddedToThread | null> {
      const guard = noteUnchanged(input.note);
      const change = threads.prepareChange({
        threadId: input.threadId,
        expectedRevision: input.expectedRevision,
        change: input.change,
        guard: { sql: `state = 'open' AND ${guard.sql}`, binds: guard.binds },
        stampActivity: true,
      });
      return write([], change, input.note, input.threadId);
    },

    /**
     * Start a Thread from the Note: the insert, then the new Thread's first
     * change, which carries the Note's date. `null` means the Note changed or
     * the Area is missing; throws when the slug is taken.
     */
    startThread(input: {
      note: Note;
      thread: NewThread;
      change: ThreadChange;
    }): Promise<NoteAddedToThread | null> {
      const insert = threads.prepareInsert(
        input.thread,
        noteUnchanged(input.note),
      );
      const change = threads.prepareChange({
        threadId: insert.threadId,
        expectedRevision: 0,
        change: input.change,
        stampActivity: true,
      });
      return write([insert.statement], change, input.note, insert.threadId);
    },
  };
}
