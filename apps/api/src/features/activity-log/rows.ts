import type { ActivityLogEntry, ActivityLogEntryId } from "@vita-os/contracts";

import { activityLogEntries } from "../../platform/d1/schema";

/**
 * Where a stored Activity Log entry becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const ACTIVITY_FIELDS = {
  id: activityLogEntries.id,
  type: activityLogEntries.type,
  content: activityLogEntries.content,
  previous_value: activityLogEntries.previous_value,
  new_value: activityLogEntries.new_value,
  created_at: activityLogEntries.created_at,
};

export type ActivityRow = Pick<
  typeof activityLogEntries.$inferSelect,
  keyof typeof ACTIVITY_FIELDS
>;

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
