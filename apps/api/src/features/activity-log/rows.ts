import type { ActivityLogEntry, ActivityLogEntryId } from "@vita-os/contracts";

/**
 * Where a stored Activity Log entry becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const ACTIVITY_COLUMNS =
  "id, type, content, previous_value, new_value, created_at";

export interface ActivityRow {
  id: string;
  type: ActivityLogEntry["type"];
  content: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: number;
}

export function toActivityLogEntry(row: ActivityRow): ActivityLogEntry {
  return {
    _id: row.id as ActivityLogEntryId,
    type: row.type,
    content: row.content,
    ...(row.previous_value === null
      ? {}
      : { previousValue: row.previous_value }),
    ...(row.new_value === null ? {} : { newValue: row.new_value }),
    createdAt: row.created_at,
  };
}
