import type { Note, NoteId, Repeat } from "@vita-os/contracts";

import { requireRepeat } from "@vita-os/core";

import { notes } from "../../platform/sqlite/schema";

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
  repeat: notes.repeat,
};

export type NoteRow = Pick<typeof notes.$inferSelect, keyof typeof NOTE_FIELDS>;

/** A Repeat as a Task holds one in `moves_json`: canonical JSON, or NULL. */
export function serializeRepeat(repeat: Repeat | undefined): string | null {
  return repeat === undefined ? null : JSON.stringify(requireRepeat(repeat));
}

function parseRepeat(value: string): Repeat {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("A stored Repeat must be valid JSON");
  }
  return requireRepeat(parsed);
}

/**
 * The physical column keeps its stored name (ADR 0028). A Repeat beside a
 * NULL date reads as no Repeat: an API from before Repeats on Notes clears the
 * date without knowing the column exists.
 */
export function toNote(row: NoteRow): Note {
  return {
    _id: row.id as NoteId,
    body: row.body,
    ...(row.attention_date === null
      ? {}
      : {
          followUp: row.attention_date,
          ...(row.repeat === null ? {} : { repeat: parseRepeat(row.repeat) }),
        }),
    state: row.state,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    createdAt: row.created_at,
    ...(row.updated_at === null ? {} : { updatedAt: row.updated_at }),
  };
}
