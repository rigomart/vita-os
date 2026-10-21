import type { Note, NotePage, PageRequest } from "@vita-os/contracts";
import type { NoteRepeatState } from "@vita-os/core";
import type { SQL } from "drizzle-orm";

import { and, count, desc, eq, sql } from "drizzle-orm";

import type { RequestScope } from "../../platform/request-scope";

import {
  doneCursor,
  pageBoundary,
  toPage,
} from "../../platform/sqlite/page-cursor";
import { notes } from "../../platform/sqlite/schema";
import { NOTE_FIELDS, serializeRepeat, toNote } from "./rows";

/** Match every term literally; SQLite LIKE ignores ASCII case. */
export function bodyContainsAll(terms: readonly string[]) {
  return and(
    ...terms.map((term) => {
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
      return sql`${notes.body} LIKE ${pattern} ESCAPE '\\'`;
    }),
  );
}

/** Standalone Notes, with one owner-scoped statement per function. */
export function noteStorage({ db, clock, actorId }: RequestScope) {
  const database = db.drizzle;
  const owned = eq(notes.user_id, actorId);

  async function update(
    noteId: string,
    columns: Partial<typeof notes.$inferInsert>,
    guard?: SQL,
  ): Promise<Note | null> {
    const [row] = await database
      .update(notes)
      .set(columns)
      .where(and(owned, eq(notes.id, noteId), guard))
      .returning(NOTE_FIELDS);
    return row === undefined ? null : toNote(row);
  }

  return {
    async listOpen(): Promise<Note[]> {
      const rows = await database
        .select(NOTE_FIELDS)
        .from(notes)
        .where(and(owned, eq(notes.state, "open")))
        .orderBy(desc(notes.created_at), desc(notes.id));
      return rows.map(toNote);
    },

    async find(noteId: string): Promise<Note | null> {
      const [row] = await database
        .select(NOTE_FIELDS)
        .from(notes)
        .where(and(owned, eq(notes.id, noteId)))
        .limit(1);
      return row === undefined ? null : toNote(row);
    },

    /** Count from the same owner/state index as the open list. */
    async countOpen(): Promise<number> {
      const [row] = await database
        .select({ total: count() })
        .from(notes)
        .where(and(owned, eq(notes.state, "open")));
      return row?.total ?? 0;
    },

    /** A bounded, stable page containing every literal search term. */
    async readDonePage(
      page: PageRequest,
      terms: readonly string[] = [],
    ): Promise<NotePage> {
      const cursor =
        page.cursor === undefined ? undefined : doneCursor.decode(page.cursor);
      const rows = await database
        .select(NOTE_FIELDS)
        .from(notes)
        .where(
          and(
            owned,
            eq(notes.state, "done"),
            bodyContainsAll(terms),
            pageBoundary(notes.completed_at, notes.id, cursor),
          ),
        )
        .orderBy(desc(notes.completed_at), desc(notes.id))
        .limit(page.limit + 1);
      return toPage(rows, page.limit, {
        toEntry: toNote,
        cursorFor: (note) => ({ at: note.completedAt ?? null, id: note._id }),
        codec: doneCursor,
      });
    },

    async insert(
      note: { body: string } & NoteRepeatState,
    ): Promise<Note | null> {
      const now = clock.now();
      const [row] = await database
        .insert(notes)
        .values({
          id: clock.newId(),
          user_id: actorId,
          body: note.body,
          attention_date: note.followUp ?? null,
          repeat: serializeRepeat(note.repeat),
          state: "open",
          completed_at: null,
          created_at: now,
          updated_at: now,
        })
        .returning(NOTE_FIELDS);
      return row === undefined ? null : toNote(row);
    },

    setBody(noteId: string, body: string): Promise<Note | null> {
      return update(noteId, { body, updated_at: clock.now() });
    },

    /**
     * Write a decided date and Repeat, only while the Note still holds the
     * state, date and Repeat the decision read; `null` means it changed (or
     * is gone) and the caller reads it again. A Repeat beside a NULL date is
     * not compared: it reads as none, and this write replaces it.
     */
    schedule(read: Note, next: NoteRepeatState): Promise<Note | null> {
      return update(
        read._id,
        {
          attention_date: next.followUp ?? null,
          repeat:
            next.followUp === undefined ? null : serializeRepeat(next.repeat),
          updated_at: clock.now(),
        },
        and(
          eq(notes.state, read.state),
          sql`${notes.attention_date} IS ${read.followUp ?? null}`,
          read.followUp === undefined
            ? undefined
            : sql`${notes.repeat} IS ${serializeRepeat(read.repeat)}`,
        ),
      );
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
      const [removed] = await database
        .delete(notes)
        .where(and(owned, eq(notes.id, noteId)))
        .returning({ id: notes.id });
      return removed !== undefined;
    },
  };
}
