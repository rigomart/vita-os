import type { WorkerEnv } from "./env";
import type { StoreResult } from "./store";

import { found, notFound } from "./store";

/**
 * The one way a record that belongs to one person is changed.
 *
 * The owner is part of the statement, not a check performed beside it, so a
 * write cannot reach somebody else's record even by mistake. The row comes back
 * from the same statement that changed it, which is what the caller reconciles
 * with; no row means the record is missing or is not theirs, and those are the
 * same answer.
 */
export async function updateOwnedRecord<TRow, TValue>(
  database: WorkerEnv["DB"],
  input: {
    table: "notes" | "thread_notes";
    columns: string;
    assignments: string;
    binds: (string | number | null)[];
    actorId: string;
    id: string;
    toValue: (row: TRow) => TValue;
  },
): Promise<StoreResult<TValue>> {
  const row = await database
    .prepare(
      `UPDATE ${input.table}
       SET ${input.assignments}
       WHERE user_id = ? AND id = ?
       RETURNING ${input.columns}`,
    )
    .bind(...input.binds, input.actorId, input.id)
    .first<TRow>();
  if (row === null) return notFound;

  return found(input.toValue(row));
}
