import type { ActivityLogEntry } from "@vita-os/contracts";
import type { LucideIcon } from "lucide-react";

import { format } from "date-fns";
import {
  ArrowRight,
  Bell,
  CircleCheck,
  CircleDot,
  MapPin,
  RotateCcw,
  SquareCheck,
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
  /** A resolution's note, in the person's own words. */
  note?: string;
  /** The Tasks a resolution dropped. */
  dropped: string[];
}

const DROPPED = " — discarded tasks: ";

/**
 * Every entry the log holds, legacy types included, read into its parts.
 * Entries written under a former name (Next Move, Follow-up date) keep their
 * label and wording.
 */
export function readActivityLogEntry(
  log: ActivityLogEntry,
): ActivityLogEntryReading {
  const previous = displayValue(log, log.previousValue);
  const next = displayValue(log, log.newValue);

  switch (log.type) {
    case "move_completed":
      return {
        label: "Task done",
        icon: SquareCheck,
        action: "Completed",
        subject: previous ?? log.content.replace(/^Completed /, ""),
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
