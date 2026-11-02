import type { ActivityLogEntry, ThreadNote } from "@vita-os/contracts";
import type { LucideIcon } from "lucide-react";

import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { format } from "date-fns";
import {
  ArrowRight,
  Bell,
  CircleCheck,
  CircleDot,
  MapPin,
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
  /**
   * A resolution's note, or the opening words of the Thread Note a
   * completion was written with.
   */
  note?: string;
  /** The Tasks a resolution dropped. */
  dropped: string[];
  /** The Thread Note choosing the line opens, while it still exists. */
  threadNote?: ThreadNote;
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
        subject: previous ?? log.content.replace(/^Completed /, ""),
        ...(threadNote === undefined ? {} : { note: openingWords(threadNote) }),
        dropped: [],
        ...opened,
      };
    case "note_added":
      return {
        label: "Note",
        icon: StickyNote,
        ...(threadNote === undefined
          ? { action: "Note added" }
          : { action: "Note added:", subject: openingWords(threadNote) }),
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
      };
    case "state_change":
      if (log.newValue === "resolved") return readResolution(log.content);
      if (log.newValue === "open") {
        return {
          label: "Reopened",
          icon: RotateCcw,
          action: "Reopened the Thread",
          dropped: [],
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

/** One entry, or the Tasks added that day, newest first. */
export type ActivityLogLine = ActivityLogEntry[];

/**
 * One day's entries, newest first, as the lines a person reads: each entry on
 * its own line, except the Tasks added that day, which share one line where
 * the newest of them sits.
 */
export function foldActivityLogDay(
  logs: readonly ActivityLogEntry[],
): ActivityLogLine[] {
  const added = logs.filter((log) => log.type === "task_added");
  return logs.flatMap((log) =>
    log.type !== "task_added" ? [[log]] : log === added[0] ? [added] : [],
  );
}

/**
 * A line as it reads: one entry, or several Tasks added the same day, named
 * in the order they were added.
 */
export function readActivityLogLine(
  logs: Readonly<ActivityLogLine>,
  threadNote?: ThreadNote,
): ActivityLogEntryReading {
  if (logs.length === 1) return readActivityLogEntry(logs[0]!, threadNote);
  return {
    label: "Tasks added",
    icon: SquarePlus,
    action: `Added ${logs.length} Tasks:`,
    subject: logs.map(addedTask).reverse().join(" · "),
    dropped: [],
  };
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

/** A Note's first line of text, as the Dashboard names a Note. */
function openingWords(note: ThreadNote) {
  return markdownToPlainText(note.body).trim().split("\n")[0]!.trim();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
