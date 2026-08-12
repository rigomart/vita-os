import type { Infer } from "convex/values";

import type { activityLogEntryTypeValidator } from "./validators";

/**
 * Derived from the schema's validator so the two cannot drift: a type the
 * database would reject is not expressible here.
 */
export type ActivityLogEntryType = Infer<typeof activityLogEntryTypeValidator>;

/** Every entry type written by a Thread change rather than by the user. */
export const AUTO_ACTIVITY_LOG_ENTRY_TYPES = [
  "area_move",
  "next_action_change",
  "state_change",
  "follow_up_change",
] as const satisfies readonly Exclude<ActivityLogEntryType, "note">[];

export type AutoActivityLogEntry = {
  type: (typeof AUTO_ACTIVITY_LOG_ENTRY_TYPES)[number];
  content: string;
  previousValue?: string;
  newValue?: string;
};

export function buildAreaMoveLogEntry(
  fromAreaName: string,
  toAreaName: string,
): AutoActivityLogEntry {
  return {
    type: "area_move",
    content: `Moved from "${fromAreaName}" to "${toAreaName}"`,
    previousValue: fromAreaName,
    newValue: toAreaName,
  };
}
