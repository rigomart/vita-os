import type { ActivityLogEntryType } from "@vita-os/contracts";

/** Every entry type the product writes to the read-only Activity Log. */
export const AUTO_ACTIVITY_LOG_ENTRY_TYPES = [
  "area_move",
  "next_move_change",
  "state_change",
  "follow_up_change",
] as const satisfies readonly ActivityLogEntryType[];

/** One entry as a rule decides it, before storage gives it an ID and a time. */
export interface AutoActivityLogEntry {
  type: (typeof AUTO_ACTIVITY_LOG_ENTRY_TYPES)[number];
  content: string;
  previousValue?: string;
  newValue?: string;
}

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
