import { DrizzleQueryError } from "drizzle-orm";

/**
 * Whether a write lost to a unique index, named by its table and columns as
 * SQLite reports them — `"areas.user_id, areas.slug"`, say.
 */
export function isUniqueViolation(error: unknown, columns: string): boolean {
  // Drizzle includes query text in its message; only the native D1 cause
  // tells us which constraint actually failed.
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return (
    cause instanceof Error &&
    cause.message.includes(`UNIQUE constraint failed: ${columns}`)
  );
}
