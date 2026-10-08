import type { Note, NoteAddedToThread, ThreadNote } from "@vita-os/contracts";
import type { SQL } from "drizzle-orm";

import { and, eq, exists, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { RequestScope } from "../../platform/request-scope";
import type { ThreadNoteRow } from "../thread-notes/rows";
import type { ThreadRow } from "../threads/rows";
import type {
  NewThread,
  PreparedThreadChange,
  ThreadChange,
} from "../threads/storage";

import {
  notes,
  threadNotes,
  threads as threadTable,
} from "../../platform/d1/schema";
import { THREAD_NOTE_FIELDS, toThreadNote } from "../thread-notes/rows";
import { threadStorage } from "../threads/storage";

/**
 * A Standalone Note becoming a Thread Note, in one guarded atomic D1 batch.
 * The Thread changes only while the source Note matches the decision. Its
 * fresh token guards copying the Note; the copy then guards source deletion.
 */
export function addToThreadStorage(scope: RequestScope) {
  const { db, clock, actorId } = scope;
  const database = drizzle(db);
  const threads = threadStorage(scope);

  /** Match the source date and body that were used to decide the change. */
  function noteUnchanged(note: Note): SQL {
    return exists(
      database
        .select({ id: notes.id })
        .from(notes)
        .where(
          and(
            eq(notes.id, note._id),
            eq(notes.user_id, actorId),
            eq(notes.state, "open"),
            sql`${notes.attention_date} IS ${note.followUp ?? null}`,
            eq(notes.body, note.body),
          ),
        ),
    );
  }

  /** Copy the Note and remove it, both behind the Thread change. */
  function copyAndRemoveNote(
    note: Note,
    threadId: string,
    change: PreparedThreadChange,
  ) {
    const threadNoteId = clock.newId();
    const copy = database
      .insert(threadNotes)
      .select(
        database
          .select({
            id: sql<string>`${threadNoteId}`.as("id"),
            user_id: notes.user_id,
            thread_id: sql<string>`${threadId}`.as("thread_id"),
            body: notes.body,
            state: sql<ThreadNote["state"]>`'open'`.as("state"),
            completed_at: sql<null>`NULL`.as("completed_at"),
            created_at: notes.created_at,
            updated_at:
              sql<number>`COALESCE(${notes.updated_at}, ${notes.created_at})`.as(
                "updated_at",
              ),
          })
          .from(notes)
          .where(
            and(
              eq(notes.id, note._id),
              eq(notes.user_id, actorId),
              eq(notes.state, "open"),
              exists(
                database
                  .select({ id: threadTable.id })
                  .from(threadTable)
                  .where(
                    and(
                      eq(threadTable.id, threadId),
                      eq(threadTable.user_id, actorId),
                      eq(threadTable.last_change_token, change.changeToken),
                    ),
                  ),
              ),
            ),
          ),
      )
      .returning(THREAD_NOTE_FIELDS);
    const removal = database.delete(notes).where(
      and(
        eq(notes.id, note._id),
        eq(notes.user_id, actorId),
        exists(
          database
            .select({ id: threadNotes.id })
            .from(threadNotes)
            .where(
              and(
                eq(threadNotes.id, threadNoteId),
                eq(threadNotes.user_id, actorId),
              ),
            ),
        ),
      ),
    );
    return { copy, removal };
  }

  async function write(
    change: PreparedThreadChange,
    note: Note,
    threadId: string,
    leading?: ReturnType<typeof threads.prepareInsert>["statement"],
  ): Promise<NoteAddedToThread | null> {
    const { copy, removal } = copyAndRemoveNote(note, threadId, change);
    // Logs and copying depend only on the fresh Thread token. Keeping their
    // queries in one batch retains rollback while preserving typed results.
    const [writtenRows, copyRows, deletion, ...insertResults] =
      leading === undefined
        ? await database.batch([
            change.update,
            copy,
            removal,
            ...change.inserts,
          ])
        : await database
            .batch([leading, change.update, copy, removal, ...change.inserts])
            .then(([, ...results]) => results);
    return settle(change, writtenRows, insertResults, copyRows, deletion);
  }

  function settle(
    change: PreparedThreadChange,
    writtenRows: ThreadRow[],
    insertResults: D1Result[],
    copyRows: ThreadNoteRow[],
    removal: D1Result,
  ): NoteAddedToThread | null {
    const thread = change.settle(writtenRows, insertResults);
    if (thread === null) return null;
    const threadNote = copyRows.at(0);
    if (threadNote === undefined || removal.meta.changes !== 1) {
      throw new Error("Adding a Note to a Thread wrote an inconsistent batch");
    }
    return { thread, threadNote: toThreadNote(threadNote) };
  }

  return {
    /** Capture into an owned Open Thread at the revision the decision read. */
    addToThread(input: {
      note: Note;
      threadId: string;
      expectedRevision: number;
      change: ThreadChange;
    }): Promise<NoteAddedToThread | null> {
      const change = threads.prepareChange({
        threadId: input.threadId,
        expectedRevision: input.expectedRevision,
        change: input.change,
        guard: and(eq(threadTable.state, "open"), noteUnchanged(input.note)),
        stampActivity: true,
      });
      return write(change, input.note, input.threadId);
    },

    /** Insert and change the new Thread, preserving the source Note's date. */
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
      return write(change, input.note, insert.threadId, insert.statement);
    },
  };
}
