import type { ThreadNote } from "@vita-os/contracts";

import { and, desc, eq, sql } from "drizzle-orm";

import type { RequestScope } from "../../platform/request-scope";

import { threadNotes, threads } from "../../platform/sqlite/schema";
import { THREAD_NOTE_FIELDS, toThreadNote } from "./rows";

/** Thread Notes, with one owner-scoped statement or atomic batch per function. */
export function threadNoteStorage({ db, clock, actorId }: RequestScope) {
  const database = db.drizzle;
  const owned = eq(threadNotes.user_id, actorId);

  /** A guarded capture that can join a Thread command's atomic batch. */
  function prepareInsert(
    threadId: string,
    body: string,
    change?: { token?: string; at: number; id?: string },
  ) {
    const now = change?.at ?? clock.now();
    const guard = and(
      eq(threads.id, threadId),
      eq(threads.user_id, actorId),
      change?.token === undefined
        ? undefined
        : eq(threads.last_change_token, change.token),
    );
    return database.insert(threadNotes).select(
      database
        .select({
          // INSERT SELECT follows the schema column order.
          id: sql<string>`${change?.id ?? clock.newId()}`.as("id"),
          user_id: sql<string>`${actorId}`.as("user_id"),
          thread_id: sql<string>`${threadId}`.as("thread_id"),
          body: sql<string>`${body}`.as("body"),
          created_at: sql<number>`${now}`.as("created_at"),
          updated_at: sql<number>`${now}`.as("updated_at"),
        })
        .from(threads)
        .where(guard),
    );
  }

  async function update(
    threadNoteId: string,
    columns: Partial<typeof threadNotes.$inferInsert>,
  ): Promise<ThreadNote | null> {
    const [row] = await database
      .update(threadNotes)
      .set(columns)
      .where(and(owned, eq(threadNotes.id, threadNoteId)))
      .returning(THREAD_NOTE_FIELDS);
    return row === undefined ? null : toThreadNote(row);
  }

  return {
    prepareInsert,
    /** Every Note of the Thread, newest first. */
    async list(threadId: string): Promise<ThreadNote[]> {
      const rows = await database
        .select(THREAD_NOTE_FIELDS)
        .from(threadNotes)
        .where(and(owned, eq(threadNotes.thread_id, threadId)))
        .orderBy(desc(threadNotes.created_at), desc(threadNotes.id));
      return rows.map(toThreadNote);
    },

    /** Capture and move the Thread activity stamp in one atomic batch. */
    async insert(threadId: string, body: string): Promise<ThreadNote | null> {
      const now = clock.now();
      const [insert] = await database.batch([
        prepareInsert(threadId, body, { at: now }).returning(
          THREAD_NOTE_FIELDS,
        ),
        database
          .update(threads)
          .set({ last_activity_at: now, last_activity_content: null })
          .where(and(eq(threads.id, threadId), eq(threads.user_id, actorId))),
      ]);
      const row = insert[0];
      return row === undefined ? null : toThreadNote(row);
    },

    setBody(threadNoteId: string, body: string): Promise<ThreadNote | null> {
      return update(threadNoteId, { body, updated_at: clock.now() });
    },

    async remove(threadNoteId: string): Promise<boolean> {
      const [removed] = await database
        .delete(threadNotes)
        .where(and(owned, eq(threadNotes.id, threadNoteId)))
        .returning({ id: threadNotes.id });
      return removed !== undefined;
    },
  };
}
