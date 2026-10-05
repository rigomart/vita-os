import type { ActivityLogEntry } from "@vita-os/contracts";

type ActivityLogType = ActivityLogEntry["type"];

const ACTIVITY_LOG_ENTRY_LABELS: Record<ActivityLogType, string> = {
  // Written before Tasks replaced the Next Move, and still read as it was.
  next_move_change: "Next move",
  move_completed: "Task done",
  state_change: "Lifecycle",
  follow_up_change: "Follow-up date",
  area_move: "Area",
};

export function getActivityLogEntryLabel(type: ActivityLogType): string {
  return ACTIVITY_LOG_ENTRY_LABELS[type];
}
