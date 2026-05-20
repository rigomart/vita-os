import type { Doc } from "@convex/_generated/dataModel";

type ActivityLogType = Doc<"projectLogs">["type"];

const ACTIVITY_LOG_ENTRY_LABELS: Record<ActivityLogType, string> = {
  note: "Note",
  status_change: "Status",
  next_action_change: "Next move",
  state_change: "Lifecycle",
  decision: "Decision",
  reference: "Reference",
  waiting_change: "Waiting",
  follow_up_change: "Follow-up",
  area_move: "Area",
};

export function getActivityLogEntryLabel(type: ActivityLogType): string {
  return ACTIVITY_LOG_ENTRY_LABELS[type];
}
