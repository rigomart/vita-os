import type { ProjectedActivityLog } from "@convex/lib/validators";

type ActivityLogType = ProjectedActivityLog["type"];

const ACTIVITY_LOG_ENTRY_LABELS: Record<ActivityLogType, string> = {
  note: "Note",
  next_action_change: "Next move",
  state_change: "Lifecycle",
  follow_up_change: "Follow-up",
  area_move: "Area",
};

export function getActivityLogEntryLabel(type: ActivityLogType): string {
  return ACTIVITY_LOG_ENTRY_LABELS[type];
}
