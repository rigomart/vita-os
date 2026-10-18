import type { BatchItem } from "drizzle-orm/batch";

import { asc, desc, eq, getTableColumns } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { RequestScope } from "../../platform/request-scope";
import type { ExportFile } from "../../platform/sqlite/export-file";

import {
  activityLogEntries,
  areas,
  notes,
  threadNotes,
  threads,
} from "../../platform/sqlite/schema";

/**
 * Wrangler's migration history, which `@vita-os/local` keeps the same way.
 * It is declared here rather than in `schema.ts` so drizzle-kit never sees it.
 */
const migrationHistory = sqliteTable("d1_migrations", {
  id: integer().primaryKey(),
  name: text(),
});

// Every stored column but the owner, so a column added to a table is exported
// without a second list to keep in step.
const { user_id: _areaOwner, ...AREA_COLUMNS } = getTableColumns(areas);
const { user_id: _threadOwner, ...THREAD_COLUMNS } = getTableColumns(threads);
const { user_id: _entryOwner, ...ENTRY_COLUMNS } =
  getTableColumns(activityLogEntries);
const { user_id: _noteOwner, ...NOTE_COLUMNS } = getTableColumns(notes);
const { user_id: _threadNoteOwner, ...THREAD_NOTE_COLUMNS } =
  getTableColumns(threadNotes);

export type StoredRows = Omit<ExportFile, "format" | "exportedAt">;

const latestMigration = (database: RequestScope["db"]["drizzle"]) =>
  database
    .select({ name: migrationHistory.name })
    .from(migrationHistory)
    .orderBy(desc(migrationHistory.id))
    .limit(1);

/** Rows per insert, well under SQLite's limit on bound values in one statement. */
const ROWS_PER_INSERT = 100;

/** Everything the owner has, read in one batch so a write can't split it. */
export function exportStorage({ db, actorId }: RequestScope) {
  const database = db.drizzle;

  return {
    async read(): Promise<StoredRows> {
      const [
        areaRows,
        threadRows,
        entryRows,
        noteRows,
        threadNoteRows,
        [latest],
      ] = await database.batch([
        database
          .select(AREA_COLUMNS)
          .from(areas)
          .where(eq(areas.user_id, actorId))
          .orderBy(asc(areas.created_at), asc(areas.id)),
        database
          .select(THREAD_COLUMNS)
          .from(threads)
          .where(eq(threads.user_id, actorId))
          .orderBy(asc(threads.created_at), asc(threads.id)),
        database
          .select(ENTRY_COLUMNS)
          .from(activityLogEntries)
          .where(eq(activityLogEntries.user_id, actorId))
          .orderBy(
            asc(activityLogEntries.created_at),
            asc(activityLogEntries.id),
          ),
        database
          .select(NOTE_COLUMNS)
          .from(notes)
          .where(eq(notes.user_id, actorId))
          .orderBy(asc(notes.created_at), asc(notes.id)),
        database
          .select(THREAD_NOTE_COLUMNS)
          .from(threadNotes)
          .where(eq(threadNotes.user_id, actorId))
          .orderBy(asc(threadNotes.created_at), asc(threadNotes.id)),
        latestMigration(database),
      ]);
      if (!latest?.name) {
        throw new Error("The database has no applied migrations.");
      }
      return {
        migration: latest.name,
        areas: areaRows,
        threads: threadRows,
        activity_log_entries: entryRows,
        notes: noteRows,
        thread_notes: threadNoteRows,
      };
    },
  };
}

/** Writes an export's rows into an empty database, as the actor's. */
export function importStorage({ db, actorId }: RequestScope) {
  const database = db.drizzle;

  return {
    /**
     * The database's newest migration and whether it holds any product row,
     * whoever owns it: import goes only into a database with nothing in it.
     */
    async readTarget(): Promise<{
      migration: string | null;
      hasRecords: boolean;
    }> {
      const [[latest], ...tables] = await database.batch([
        latestMigration(database),
        database.select({ id: areas.id }).from(areas).limit(1),
        database.select({ id: threads.id }).from(threads).limit(1),
        database
          .select({ id: activityLogEntries.id })
          .from(activityLogEntries)
          .limit(1),
        database.select({ id: notes.id }).from(notes).limit(1),
        database.select({ id: threadNotes.id }).from(threadNotes).limit(1),
      ]);
      return {
        migration: latest?.name ?? null,
        hasRecords: tables.some((rows) => rows.length > 0),
      };
    },

    /** Every row in one batch, so a failure part way writes nothing. */
    async write(rows: StoredRows): Promise<void> {
      const owned = <R extends object>(list: R[]) =>
        list.map((row) => ({ ...row, user_id: actorId }));
      const statements: BatchItem<"sqlite">[] = [
        ...chunks(owned(rows.areas)).map((chunk) =>
          database.insert(areas).values(keepingUnlistedIcons(chunk)),
        ),
        ...chunks(owned(rows.threads)).map((chunk) =>
          database.insert(threads).values(chunk),
        ),
        ...chunks(owned(rows.activity_log_entries)).map((chunk) =>
          database.insert(activityLogEntries).values(chunk),
        ),
        ...chunks(owned(rows.notes)).map((chunk) =>
          database.insert(notes).values(chunk),
        ),
        ...chunks(owned(rows.thread_notes)).map((chunk) =>
          database.insert(threadNotes).values(chunk),
        ),
      ];
      const [first, ...rest] = statements;
      if (first === undefined) return;
      await database.batch([first, ...rest]);
    },
  };
}

const keepingUnlistedIcons = (rows: object[]) =>
  rows as (typeof areas.$inferInsert)[];

function chunks<R>(rows: R[]): R[][] {
  const result: R[][] = [];
  for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
    result.push(rows.slice(start, start + ROWS_PER_INSERT));
  }
  return result;
}
