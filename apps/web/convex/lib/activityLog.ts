export type ActivityLogEntryType =
  | "note"
  | "status_change"
  | "next_action_change"
  | "state_change"
  | "decision"
  | "reference"
  | "waiting_change"
  | "follow_up_change"
  | "area_move";

export const AUTO_ACTIVITY_LOG_ENTRY_TYPES = [
  "status_change",
  "next_action_change",
  "state_change",
  "decision",
  "reference",
  "waiting_change",
  "follow_up_change",
  "area_move",
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
