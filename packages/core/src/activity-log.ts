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

/**
 * A change to a Thread's Area label. An absent name is an absent label, so the
 * one entry type covers labeling an unlabeled Thread, moving between Areas,
 * and removing the label.
 */
export function buildAreaMoveLogEntry(
  fromAreaName: string | undefined,
  toAreaName: string | undefined,
): AutoActivityLogEntry | null {
  if (fromAreaName && toAreaName) {
    return {
      type: "area_move",
      content: `Moved from "${fromAreaName}" to "${toAreaName}"`,
      previousValue: fromAreaName,
      newValue: toAreaName,
    };
  }
  if (toAreaName) {
    return {
      type: "area_move",
      content: `Added to "${toAreaName}"`,
      newValue: toAreaName,
    };
  }
  if (fromAreaName) {
    return {
      type: "area_move",
      content: `Removed from "${fromAreaName}"`,
      previousValue: fromAreaName,
    };
  }
  return null;
}
