import type { ActivityLogEntry, ThreadNote } from "@vita-os/contracts";
import type { LucideIcon } from "lucide-react";

import { NOTE_STARTED_THREAD } from "@vita-os/core";
import { format, isSameDay } from "date-fns";
import {
  ArrowRight,
  Bell,
  CircleCheck,
  CircleDot,
  Flag,
  MapPin,
  Repeat,
  RotateCcw,
  SquareCheck,
  SquareMinus,
  SquarePlus,
  StickyNote,
} from "lucide-react";

import { withTimeToken } from "../attention-list/date-parts";

/** One entry as a person reads it: what happened, to what, and what it carried. */
export interface ActivityLogEntryReading {
  /** A short name for the kind of change, for assistive technology. */
  label: string;
  icon: LucideIcon;
  /** The verb phrase, read quietly: "Completed", "Moved to". */
  action: string;
  /** What it happened to, read in full. */
  subject?: string;
  /** What it replaced, when it replaced something. */
  from?: string;
  /** How many times it happened, when a line folds a stretch of them. */
  times?: number;
  /** Quiet words after the sentence: ", with a note since deleted". */
  aside?: string;
  /** A resolution's note. */
  note?: string;
  /** The Tasks a resolution dropped. */
  dropped: string[];
  /**
   * The Thread Note the line is about, while it still exists: the line reads
   * it and opens it.
   */
  threadNote?: ThreadNote;
  /**
   * A change to what the Thread is (its beginning, its ending, its return,
   * its Area), which reads at full size among the small lines.
   */
  turningPoint?: true;
}

const DROPPED = " — discarded tasks: ";

/**
 * Every entry the log holds, legacy types included, read into its parts.
 * Entries written under a former name (Next Move, Follow-up date) keep their
 * label and wording.
 *
 * `threadNote` is the Thread Note the entry names, as it reads now; absent
 * once that Note is deleted.
 */
export function readActivityLogEntry(
  log: ActivityLogEntry,
  threadNote?: ThreadNote,
): ActivityLogEntryReading {
  const previous = displayValue(log, log.previousValue);
  const next = displayValue(log, log.newValue);
  const opened = threadNote === undefined ? {} : { threadNote };

  switch (log.type) {
    case "move_completed":
      return {
        label: "Task done",
        icon: SquareCheck,
        action: "Completed",
        subject: completedTask(log),
        ...(log.threadNoteId !== undefined && threadNote === undefined
          ? { aside: ", with a note since deleted" }
          : {}),
        dropped: [],
        ...opened,
      };
    case "note_added":
      return {
        label: "Note",
        icon: StickyNote,
        action:
          threadNote === undefined ? "Note added, since deleted" : "Note added",
        dropped: [],
        ...opened,
      };
    case "task_added":
      return {
        label: "Task added",
        icon: SquarePlus,
        action: "Added",
        subject: addedTask(log),
        dropped: [],
      };
    case "task_removed":
      return {
        label: "Task removed",
        icon: SquareMinus,
        action: "Removed",
        subject: previous ?? log.content,
        dropped: [],
      };
    case "area_move":
      return {
        label: "Area",
        icon: MapPin,
        ...(previous && next
          ? { action: "Moved to", subject: next, from: previous }
          : next
            ? { action: "Added to", subject: next }
            : previous
              ? { action: "Removed from", subject: previous }
              : { action: log.content }),
        dropped: [],
        turningPoint: true,
      };
    case "state_change":
      if (log.newValue === "resolved") return readResolution(log.content);
      if (log.newValue === "open") {
        return {
          label: "Reopened",
          icon: RotateCcw,
          action: "Reopened the Thread",
          dropped: [],
          turningPoint: true,
        };
      }
      return {
        label: "Lifecycle",
        icon: CircleDot,
        ...(next
          ? {
              action: "Changed to",
              subject: capitalize(next),
              ...(previous ? { from: capitalize(previous) } : {}),
            }
          : { action: log.content }),
        dropped: [],
        turningPoint: true,
      };
    case "follow_up_change":
      return {
        label: "Follow-up date",
        icon: Bell,
        ...(previous && next
          ? { action: "Moved the Follow-up to", subject: next, from: previous }
          : next
            ? { action: "Set the Follow-up for", subject: next }
            : previous
              ? { action: "Cleared the Follow-up", subject: previous }
              : { action: log.content }),
        dropped: [],
      };
    case "next_move_change":
      return {
        label: "Next move",
        icon: ArrowRight,
        ...(log.content.startsWith("Completed") && previous
          ? { action: "Completed", subject: previous }
          : previous && next
            ? {
                action: "Changed the next move to",
                subject: next,
                from: previous,
              }
            : next
              ? { action: "Set the next move to", subject: next }
              : previous
                ? { action: "Cleared the next move", subject: previous }
                : { action: log.content }),
        dropped: [],
      };
  }
}

/**
 * A line of the log, newest entry first: one entry, a day's Tasks added, a
 * stretch of one Task's completions, or the Thread's beginning, which is read
 * from its creation and never stored. A Thread started from a Note begins
 * with that Note's entry, its `origin`, which then has no line of its own.
 */
export type ActivityLogLine =
  | { kind: "entries"; logs: ActivityLogEntry[] }
  | { kind: "started"; at: number; origin?: ActivityLogEntry };

/**
 * Lines read under one heading, newest first: a day's, or a stretch of
 * completions spanning several days, under its first and last days.
 */
export interface ActivityLogGroup {
  key: string;
  /** The oldest and newest moments the group covers. */
  from: number;
  to: number;
  lines: ActivityLogLine[];
}

/**
 * The whole loaded log as a person reads it, newest first.
 *
 * - A day's Tasks added share one line where the newest of them sits.
 * - Completions of one Task with no other line between them share one line,
 *   unless a completion carries a Note: it stands alone with its Note.
 * - `threadCreatedAt`, once the oldest page is loaded, ends the log with
 *   Started at that moment, below any entry written at the same instant. The
 *   entry of the Note the Thread was started from becomes part of it.
 *
 * Pages are folded together, so a stretch cut by a page boundary grows into
 * one line as earlier pages load.
 */
export function readActivityLog(
  logs: readonly ActivityLogEntry[],
  threadCreatedAt?: number,
): ActivityLogGroup[] {
  const newestFirst = [...logs].sort((a, b) => b.createdAt - a.createdAt);
  const days = new Map<string, ActivityLogEntry[]>();
  for (const log of newestFirst) {
    const key = dayKey(log.createdAt);
    days.set(key, [...(days.get(key) ?? []), log]);
  }
  let lines: ActivityLogLine[] = foldStretches(
    [...days.values()].flatMap(foldActivityLogDay),
  ).map((logs) => ({ kind: "entries", logs }));
  if (threadCreatedAt !== undefined) {
    const origin = logs.find(
      (log) => log.type === "note_added" && log.content === NOTE_STARTED_THREAD,
    );
    const started: ActivityLogLine = {
      kind: "started",
      at: threadCreatedAt,
      ...(origin === undefined ? {} : { origin }),
    };
    lines = lines.filter(
      (line) => line.kind !== "entries" || line.logs[0] !== origin,
    );
    const older = lines.findIndex((line) => newestAt(line) < threadCreatedAt);
    lines.splice(older === -1 ? lines.length : older, 0, started);
  }
  return groupLines(lines);
}

/**
 * One day's entries, newest first, as lines: each entry on its own, except
 * the Tasks added that day, which share one line where the newest of them
 * sits.
 */
export function foldActivityLogDay(
  logs: readonly ActivityLogEntry[],
): ActivityLogEntry[][] {
  const added = logs.filter((log) => log.type === "task_added");
  return logs.flatMap((log) =>
    log.type !== "task_added" ? [[log]] : log === added[0] ? [added] : [],
  );
}

function foldStretches(lines: ActivityLogEntry[][]): ActivityLogEntry[][] {
  const folded: ActivityLogEntry[][] = [];
  for (const line of lines) {
    const previous = folded.at(-1);
    if (
      previous !== undefined &&
      foldsIntoStretch(previous[0]!) &&
      foldsIntoStretch(line[0]!) &&
      completedTask(previous[0]!) === completedTask(line[0]!)
    ) {
      previous.push(line[0]!);
    } else {
      folded.push([...line]);
    }
  }
  return folded;
}

function foldsIntoStretch(log: ActivityLogEntry) {
  return log.type === "move_completed" && log.threadNoteId === undefined;
}

function groupLines(lines: ActivityLogLine[]): ActivityLogGroup[] {
  const groups: ActivityLogGroup[] = [];
  for (const line of lines) {
    const [from, to] = [oldestAt(line), newestAt(line)];
    const spansDays = !isSameDay(from, to);
    const current = groups.at(-1);
    if (
      current !== undefined &&
      !spansDays &&
      isSameDay(current.from, current.to) &&
      isSameDay(current.to, to)
    ) {
      current.lines.push(line);
      current.from = from;
    } else {
      groups.push({ key: lineKey(line), from, to, lines: [line] });
    }
  }
  return groups;
}

export function lineKey(line: ActivityLogLine) {
  return line.kind === "started" ? "started" : line.logs[0]!._id;
}

export function newestAt(line: ActivityLogLine) {
  return line.kind === "started" ? line.at : line.logs[0]!.createdAt;
}

function oldestAt(line: ActivityLogLine) {
  return line.kind === "started" ? line.at : line.logs.at(-1)!.createdAt;
}

function dayKey(at: number) {
  return format(at, "yyyy-MM-dd");
}

/**
 * A line as it reads: one entry, several Tasks added the same day named in
 * the order they were added, a stretch of completions counted, or Started.
 *
 * `threadNote` is the Thread Note the line's entry names, or the one the
 * Thread was started from, as it reads now; absent once it is deleted.
 */
export function readActivityLogLine(
  line: ActivityLogLine,
  threadNote?: ThreadNote,
): ActivityLogEntryReading {
  if (line.kind === "started") {
    return {
      label: "Started",
      icon: Flag,
      action:
        line.origin === undefined
          ? "Started"
          : threadNote === undefined
            ? "Started from a note, since deleted"
            : "Started the Thread from this note",
      dropped: [],
      turningPoint: true,
      ...(threadNote === undefined ? {} : { threadNote }),
    };
  }
  const { logs } = line;
  if (logs.length === 1) return readActivityLogEntry(logs[0]!, threadNote);
  if (logs[0]!.type === "move_completed") {
    return {
      label: "Task done",
      icon: Repeat,
      action: "Completed",
      subject: completedTask(logs[0]!),
      times: logs.length,
      dropped: [],
    };
  }
  return {
    label: "Tasks added",
    icon: SquarePlus,
    action: `Added ${logs.length} Tasks:`,
    subject: logs.map(addedTask).reverse().join(" · "),
    dropped: [],
  };
}

function completedTask(log: ActivityLogEntry) {
  return log.previousValue ?? log.content.replace(/^Completed /, "");
}

function addedTask(log: ActivityLogEntry) {
  return log.newValue ?? log.content;
}

/**
 * `Resolved thread[: note][ — discarded tasks: "a", "b"]`, as core writes it.
 * Read back from the text, so a note that itself contains the separator, or a
 * Task containing `", "`, splits in the wrong place.
 */
function readResolution(content: string): ActivityLogEntryReading {
  const cut = content.indexOf(DROPPED);
  const head = cut === -1 ? content : content.slice(0, cut);
  const tail = cut === -1 ? "" : content.slice(cut + DROPPED.length);
  const note = head.startsWith("Resolved thread: ")
    ? head.slice("Resolved thread: ".length)
    : undefined;
  return {
    label: "Resolved",
    icon: CircleCheck,
    action: "Resolved the Thread",
    ...(note ? { note } : {}),
    dropped: tail ? tail.slice(1, -1).split('", "') : [],
    turningPoint: true,
  };
}

/**
 * A Follow-up change records the raw timestamp, written here in the reader's
 * own time zone. Entries recorded before that hold their date already
 * written, and read as they are.
 */
function displayValue(log: ActivityLogEntry, value?: string) {
  if (log.type !== "follow_up_change" || !value || !/^\d+$/.test(value)) {
    return value;
  }
  const when = Number(value);
  return withTimeToken(format(when, "MMM d, yyyy"), when);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
