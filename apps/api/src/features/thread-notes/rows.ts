import type { ThreadNote, ThreadNoteId } from "@vita-os/contracts";

import { threadNotes } from "../../platform/d1/schema";

/**
 * Where a stored Thread Note becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const THREAD_NOTE_FIELDS = {
  id: threadNotes.id,
  body: threadNotes.body,
  state: threadNotes.state,
  completed_at: threadNotes.completed_at,
  created_at: threadNotes.created_at,
  updated_at: threadNotes.updated_at,
};

export type ThreadNoteRow = Pick<
  typeof threadNotes.$inferSelect,
  keyof typeof THREAD_NOTE_FIELDS
>;

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
