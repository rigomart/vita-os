import type { ActivityLogEntryType } from "@vita-os/contracts";

/**
 * Every entry type the product writes to the read-only Activity Log. Entries of
 * the retired `next_move_change` type are still read, but never written.
 */
export const AUTO_ACTIVITY_LOG_ENTRY_TYPES = [
  "area_move",
  "move_completed",
  "note_added",
  "task_added",
  "task_removed",
  "state_change",
  "follow_up_change",
] as const satisfies readonly ActivityLogEntryType[];

/** One entry as a rule decides it, before storage gives it an ID and a time. */
export interface AutoActivityLogEntry {
  type: (typeof AUTO_ACTIVITY_LOG_ENTRY_TYPES)[number];
  content: string;
  previousValue?: string;
  newValue?: string;
  /** The Thread Note the entry is about. The log never holds its words. */
  threadNoteId?: string;
}

/**
 * A Thread Note was captured, written with a completion aside: that
 * completion's entry names the Note instead (`withCompletionNote`).
 */
export function buildNoteAddedLogEntry(
  threadNoteId: string,
): AutoActivityLogEntry {
  return { type: "note_added", content: "Note added", threadNoteId };
}

/** One entry per Task added; the Activity Log folds a day's into one line only when read. */
export function buildTaskAddedLogEntry(text: string): AutoActivityLogEntry {
  return { type: "task_added", content: `Added "${text}"`, newValue: text };
}

/** A Task left the plan without being completed. */
export function buildTaskRemovedLogEntry(text: string): AutoActivityLogEntry {
  return {
    type: "task_removed",
    content: `Removed "${text}"`,
    previousValue: text,
  };
}

/** A completion written with a Note names it, so the one line carries both. */
export function withCompletionNote(
  logs: AutoActivityLogEntry[],
  threadNoteId: string,
): AutoActivityLogEntry[] {
  return logs.map((log) =>
    log.type === "move_completed" ? { ...log, threadNoteId } : log,
  );
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
