import type { Note, NoteId } from "@vita-os/contracts";

import { notes } from "../../platform/d1/schema";

/**
 * Where a stored Standalone Note becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const NOTE_FIELDS = {
  id: notes.id,
  body: notes.body,
  attention_date: notes.attention_date,
  state: notes.state,
  completed_at: notes.completed_at,
  created_at: notes.created_at,
  updated_at: notes.updated_at,
};

export type NoteRow = Pick<typeof notes.$inferSelect, keyof typeof NOTE_FIELDS>;

// The physical column keeps its stored name (ADR 0028).
export function toNote(row: NoteRow): Note {
  return {
    _id: row.id as NoteId,
    body: row.body,
    ...(row.attention_date === null ? {} : { followUp: row.attention_date }),
    state: row.state,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    createdAt: row.created_at,
    ...(row.updated_at === null ? {} : { updatedAt: row.updated_at }),
  };
}
