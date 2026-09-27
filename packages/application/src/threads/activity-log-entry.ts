import type { ActivityLogEntry } from "@vita-os/contracts";

type ActivityLogType = ActivityLogEntry["type"];

const ACTIVITY_LOG_ENTRY_LABELS: Record<ActivityLogType, string> = {
  // Written before Moves replaced the Next Move, and still read as it was.
  next_move_change: "Next move",
  move_completed: "Move done",
  state_change: "Lifecycle",
  follow_up_change: "Follow-up",
  area_move: "Area",
};

export function getActivityLogEntryLabel(type: ActivityLogType): string {
  return ACTIVITY_LOG_ENTRY_LABELS[type];
}
