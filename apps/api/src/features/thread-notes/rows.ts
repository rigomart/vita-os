import type { ThreadNote, ThreadNoteId } from "@vita-os/contracts";

/**
 * Where a stored Thread Note becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const THREAD_NOTE_COLUMNS =
  "id, body, state, completed_at, created_at, updated_at";

export interface ThreadNoteRow {
  id: string;
  body: string;
  state: ThreadNote["state"];
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export function toThreadNote(row: ThreadNoteRow): ThreadNote {
  return {
    _id: row.id as ThreadNoteId,
    body: row.body,
    state: row.state,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
