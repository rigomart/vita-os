import type { Note, NoteId } from "@vita-os/contracts";

/**
 * Where a stored Standalone Note becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const NOTE_COLUMNS =
  "id, body, attention_date, state, completed_at, created_at, updated_at";

export interface NoteRow {
  id: string;
  body: string;
  attention_date: number | null;
  state: Note["state"];
  completed_at: number | null;
  created_at: number;
  updated_at: number | null;
}

export function toNote(row: NoteRow): Note {
  return {
    _id: row.id as NoteId,
    body: row.body,
    ...(row.attention_date === null
      ? {}
      : { attentionDate: row.attention_date }),
    state: row.state,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    createdAt: row.created_at,
    ...(row.updated_at === null ? {} : { updatedAt: row.updated_at }),
  };
}
