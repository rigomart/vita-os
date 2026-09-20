import type { ActivityLogEntry } from "@vita-os/contracts";

type ActivityLogType = ActivityLogEntry["type"];

const ACTIVITY_LOG_ENTRY_LABELS: Record<ActivityLogType, string> = {
  next_move_change: "Next move",
  state_change: "Lifecycle",
  follow_up_change: "Follow-up",
  area_move: "Area",
};

export function getActivityLogEntryLabel(type: ActivityLogType): string {
  return ACTIVITY_LOG_ENTRY_LABELS[type];
}
