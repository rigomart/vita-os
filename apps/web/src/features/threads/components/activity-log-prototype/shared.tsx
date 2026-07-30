// PROTOTYPE — throwaway code. Shared data helpers for the activity-log
// redesign variants. Do not import from production code.
import type { Doc } from "@convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format, isToday, isYesterday } from "date-fns";
import {
  ArrowRight,
  Bell,
  CircleCheck,
  Clock3,
  Link2,
  MapPin,
  PenLine,
  RefreshCw,
  Scale,
} from "lucide-react";
import { useState } from "react";

export type ActivityLogEntry = Doc<"activityLogs">;
export type AutomaticActivityLogEntry = ActivityLogEntry & {
  type: Exclude<ActivityLogEntry["type"], "note">;
};

export interface ActivityLogVariantProps {
  logs: ActivityLogEntry[] | undefined;
  onAddNote: (text: string) => Promise<void> | void;
}

export const ACTIVITY_LOG_ICONS: Record<
  AutomaticActivityLogEntry["type"] | "note",
  LucideIcon
> = {
  note: PenLine,
  status_change: RefreshCw,
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  decision: Scale,
  reference: Link2,
  waiting_change: Clock3,
  follow_up_change: Bell,
  area_move: MapPin,
};

export function isAutomaticActivityLogEntry(
  log: ActivityLogEntry,
): log is AutomaticActivityLogEntry {
  return log.type !== "note";
}

export function getAutomaticChangeSummary(log: AutomaticActivityLogEntry) {
  if (log.previousValue && log.newValue) {
    return `${log.previousValue} → ${log.newValue}`;
  }

  if (log.newValue) return `Set to ${log.newValue}`;

  if (log.previousValue) {
    return log.type === "next_action_change" &&
      log.content.startsWith("Completed")
      ? `Completed ${log.previousValue}`
      : `Cleared ${log.previousValue}`;
  }

  return log.content;
}

export function getDayLabel(createdAt: number) {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export function groupLogsByDay(logs: ActivityLogEntry[]) {
  const groups = new Map<string, ActivityLogEntry[]>();

  for (const log of [...logs].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = format(new Date(log.createdAt), "yyyy-MM-dd");
    const group = groups.get(key) ?? [];
    group.push(log);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, groupLogs]) => ({
    key,
    label: getDayLabel(groupLogs[0]!.createdAt),
    logs: groupLogs,
  }));
}

export function formatTime(createdAt: number) {
  return format(new Date(createdAt), "h:mm a");
}

export function formatTimeTitle(createdAt: number) {
  return format(new Date(createdAt), "PPpp");
}

/**
 * Runs of consecutive automatic entries collapsed into clusters, notes kept
 * as standalone items. Useful for variants that de-emphasize system changes.
 */
export function clusterLogs(logs: ActivityLogEntry[]) {
  const clusters: (
    | { kind: "note"; log: ActivityLogEntry }
    | { kind: "changes"; logs: AutomaticActivityLogEntry[] }
  )[] = [];

  for (const log of logs) {
    if (!isAutomaticActivityLogEntry(log)) {
      clusters.push({ kind: "note", log });
      continue;
    }

    const last = clusters.at(-1);
    if (last?.kind === "changes") {
      last.logs.push(log);
    } else {
      clusters.push({ kind: "changes", logs: [log] });
    }
  }

  return clusters;
}

/** Composer form state shared across variants; rendering stays per-variant. */
export function useNoteComposer(
  onAddNote: ActivityLogVariantProps["onAddNote"],
) {
  const [noteText, setNoteText] = useState("");
  const { run: addNote, isPending } = useGuardedAsyncAction(onAddNote, {
    errorToast: true,
  });

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text || isPending) return;

    const result = await addNote(text);
    if (result.ok) setNoteText("");
  };

  return { noteText, setNoteText, submitNote, isPending };
}
