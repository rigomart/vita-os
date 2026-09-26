/**
 * Small pieces of SQL that several features' storage builds statements from.
 *
 * Nothing here reads or writes on its own; each helper only shapes the text and
 * parameters of one statement, so the storage function using it still makes
 * exactly one round trip.
 */

export type SqlValue = string | number | null;

/** A column set from the row's own value rather than from a parameter. */
export type SqlExpression = { readonly sql: string };

export function sqlExpression(sql: string): SqlExpression {
  return { sql };
}

/**
 * The SET list of an UPDATE, from the columns a change names.
 *
 * `undefined` leaves a column alone and `null` stores NULL, the same distinction
 * the application contract draws between absent and cleared.
 */
export function setClause(
  columns: Record<string, SqlValue | SqlExpression | undefined>,
): { sql: string; binds: SqlValue[] } {
  const assignments: string[] = [];
  const binds: SqlValue[] = [];
  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object") {
      assignments.push(`${column} = ${value.sql}`);
    } else {
      assignments.push(`${column} = ?`);
      binds.push(value);
    }
  }

  return { sql: assignments.join(", "), binds };
}

/**
 * Whether a write lost to a unique index, named by its table and columns as
 * SQLite reports them — `"areas.user_id, areas.slug"`, say.
 */
export function isUniqueViolation(error: unknown, columns: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes(`UNIQUE constraint failed: ${columns}`)
  );
}

/** A table's columns, qualified, and optionally aliased under a prefix. */
export function prefixColumns(
  table: string,
  columns: string,
  alias = "",
): string {
  return columns
    .split(",")
    .map((column) => column.trim())
    .map((column) =>
      alias === ""
        ? `${table}.${column}`
        : `${table}.${column} AS ${alias}${column}`,
    )
    .join(", ");
}

/**
 * The joined table's own columns, taken back out of the joined row.
 *
 * A join has to alias one side's columns — both tables have an `id` — so that
 * side arrives prefixed and is read back out under its own names.
 */
export function joinedColumns(
  row: Record<string, unknown>,
  alias: string,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith(alias)) columns[key.slice(alias.length)] = value;
  }
  return columns;
}
