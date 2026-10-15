import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { DrizzleQueryError } from "drizzle-orm";

/**
 * A Drizzle SQLite database that can send several statements as one atomic
 * round trip. Drizzle's D1 and libsql databases both fit.
 *
 * What a statement without `returning` resolves to differs by driver, so it is
 * left `unknown` here and read only through {@link Database.changes}.
 */
export type SQLiteDatabase = BaseSQLiteDatabase<"async", unknown> & {
  batch<U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(
    batch: T,
  ): Promise<BatchResponse<T>>;
};

/**
 * What storage needs from a database, and nothing else: each host adapts its
 * own driver to it. Storage still makes one round trip per function, and the
 * operations keep every guard, so this is not a repository.
 */
export interface Database {
  drizzle: SQLiteDatabase;
  /**
   * How many rows a statement wrote: `meta.changes` on D1, `rowsAffected` on
   * libsql. Only for statements without `returning`: libsql can't count those.
   */
  changes(result: unknown): number;
  /**
   * Whether a write lost to a unique index, named by its table and columns as
   * SQLite reports them — `"areas.user_id, areas.slug"`, say.
   */
  isUniqueViolation(error: unknown, columns: string): boolean;
}

/**
 * {@link Database.isUniqueViolation} for SQLite's own wording, which D1 and
 * libsql both pass on: `UNIQUE constraint failed: areas.user_id, areas.slug`.
 * Drizzle includes query text in its message, so only the driver's error, or
 * the cause Drizzle wraps, says which constraint actually failed.
 */
export function isSqliteUniqueViolation(
  error: unknown,
  columns: string,
): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return (
    cause instanceof Error &&
    cause.message.includes(`UNIQUE constraint failed: ${columns}`)
  );
}
