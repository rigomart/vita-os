import type { ThreadNote } from "@vita-os/contracts";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { cn } from "@vita-os/ui/lib/utils";
import { isSameDay } from "date-fns";

import { NoteMarker } from "../../notes/note-marker";
import {
  type ActivityLogEntryReading,
  type ActivityLogLine,
  newestAt,
  readActivityLogLine,
} from "../activity-log-entry";
import { FoldLine } from "./thread-log-fold";
import {
  BareNode,
  OPENABLE_LINE_HOVER,
  Sentence,
  Time,
} from "./thread-log-parts";

interface ActivityLogLineItemProps {
  line: ActivityLogLine;
  /** When the Thread was created, once the log reaches it. */
  startedAt?: number;
  threadNotes?: ThreadNote[];
  onOpenNote?: (note: ThreadNote) => void;
  today: number;
}

/**
 * One line of the log, in one of four shapes:
 * - a Thread Note, in its own words at full size, with what happened with it
 *   (a completion, the Thread starting) as a small caption above;
 * - a turning point, a full-size sentence on a ringed node;
 * - a fold, a small line that opens;
 * - everything else, a small muted sentence.
 */
export function ActivityLogLineItem({
  line,
  startedAt,
  threadNotes,
  onOpenNote,
  today,
}: ActivityLogLineItemProps) {
  const named =
    line.kind === "started"
      ? line.origin?.threadNoteId
      : line.logs.length === 1
        ? line.logs[0]!.threadNoteId
        : undefined;
  const threadNote =
    named === undefined
      ? undefined
      : threadNotes?.find((note) => note._id === named);
  const reading = readActivityLogLine(line, threadNote);
  const at = newestAt(line);
  const datedByHeading =
    line.kind === "entries" &&
    !isSameDay(line.logs[0]!.createdAt, line.logs.at(-1)!.createdAt);
  const time = datedByHeading ? undefined : at;

  if (line.kind === "entries" && line.logs.length > 1) {
    return (
      <FoldLine reading={reading} logs={line.logs} time={time} today={today} />
    );
  }
  if (reading.threadNote !== undefined) {
    const noteEntry =
      line.kind === "entries" && line.logs[0]!.type === "note_added";
    return (
      <NoteLine
        note={reading.threadNote}
        caption={
          !noteEntry ? (
            <>
              <span className="sr-only">{reading.label}: </span>
              <Sentence reading={reading} />
            </>
          ) : startedAt !== undefined && at < startedAt ? (
            "Written before the Thread started"
          ) : undefined
        }
        captionIcon={noteEntry ? undefined : reading.icon}
        time={time}
        onOpenNote={onOpenNote}
      />
    );
  }
  if (reading.turningPoint)
    return <TurningLine reading={reading} time={time} />;
  return <SmallLine reading={reading} time={time} />;
}

function NoteLine({
  note,
  caption,
  captionIcon: CaptionIcon,
  time,
  onOpenNote,
}: {
  note: ThreadNote;
  caption?: ReactNode;
  captionIcon?: LucideIcon;
  time?: number;
  onOpenNote?: (note: ThreadNote) => void;
}) {
  const text = markdownToPlainText(note.body).trim();
  const words = (
    <span className="line-clamp-4 text-sm leading-relaxed whitespace-pre-line wrap-anywhere text-foreground">
      {text.replace(/\n{2,}/g, "\n")}
    </span>
  );
  return (
    <li
      className={cn(
        "relative my-1 flex gap-3 py-2",
        onOpenNote && OPENABLE_LINE_HOVER,
      )}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center rounded-md bg-popover">
        <NoteMarker className="h-3.5 w-3 rounded-[2px] border-muted-foreground/70" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        {caption !== undefined && (
          <div className="flex items-baseline gap-3">
            <p className="flex min-w-0 flex-1 items-baseline gap-1.5 text-xs leading-snug wrap-anywhere text-muted-foreground">
              {CaptionIcon && (
                <CaptionIcon
                  aria-hidden
                  className="size-3 shrink-0 translate-y-0.5"
                />
              )}
              <span>{caption}</span>
            </p>
            {time !== undefined && <Time at={time} />}
          </div>
        )}
        <div className="flex items-baseline gap-3">
          {onOpenNote ? (
            <button
              type="button"
              onClick={() => onOpenNote(note)}
              aria-label={`Open note: ${text.slice(0, 120)}`}
              className="block min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-lg"
            >
              {words}
            </button>
          ) : (
            <div className="min-w-0 flex-1">{words}</div>
          )}
          {caption === undefined && time !== undefined && <Time at={time} />}
        </div>
      </div>
    </li>
  );
}

function TurningLine({
  reading,
  time,
}: {
  reading: ActivityLogEntryReading;
  time?: number;
}) {
  const Icon = reading.icon;
  return (
    <li className="relative my-1 flex gap-3 py-2">
      <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-popover text-muted-foreground">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 text-sm leading-snug wrap-anywhere">
            <span className="sr-only">{reading.label}: </span>
            <span className="font-medium text-foreground">
              {reading.action}
            </span>
            {reading.subject !== undefined && (
              <span className="text-foreground"> {reading.subject}</span>
            )}
            {reading.from !== undefined && (
              <span className="text-muted-foreground">
                , from {reading.from}
              </span>
            )}
          </p>
          {time !== undefined && <Time at={time} />}
        </div>
        <Carried reading={reading} />
      </div>
    </li>
  );
}

function SmallLine({
  reading,
  time,
}: {
  reading: ActivityLogEntryReading;
  time?: number;
}) {
  return (
    <li className="relative flex gap-3 py-1">
      <BareNode icon={reading.icon} />
      <div className="flex min-w-0 flex-1 items-baseline gap-3 pt-1">
        <p className="min-w-0 flex-1 text-xs leading-snug wrap-anywhere">
          <span className="sr-only">{reading.label}: </span>
          <Sentence reading={reading} />
        </p>
        {time !== undefined && <Time at={time} />}
      </div>
    </li>
  );
}

function Carried({ reading }: { reading: ActivityLogEntryReading }) {
  if (reading.note === undefined && reading.dropped.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {reading.note !== undefined && (
        <p className="border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-line wrap-anywhere text-foreground">
          {reading.note}
        </p>
      )}
      {reading.dropped.length > 0 && (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <p>
            Dropped{" "}
            {reading.dropped.length === 1
              ? "an open Task"
              : `${reading.dropped.length} open Tasks`}
          </p>
          <ul className="flex flex-col gap-0.5">
            {reading.dropped.map((task, index) => (
              <li key={index} className="flex gap-2 wrap-anywhere">
                <span aria-hidden>–</span>
                <span className="text-foreground/75">{task}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
