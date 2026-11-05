import type { ActivityLogEntry } from "@vita-os/contracts";

import { cn } from "@vita-os/ui/lib/utils";
import { format, isSameYear, startOfDay } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import {
  type ActivityLogEntryReading,
  readActivityLogEntry,
} from "../activity-log-entry";
import {
  describeRhythm,
  readRhythm,
  type Rhythm,
  shortDay,
} from "../activity-log-rhythm";
import {
  BareNode,
  OPENABLE_LINE_HOVER,
  Sentence,
  Time,
} from "./thread-log-parts";

/**
 * A folded line: a stretch of one Task's completions with its rhythm under
 * it, or a day's Tasks added. Choosing it opens it in place, to the
 * stretch's days by month or to each Task added.
 */
export function FoldLine({
  reading,
  logs,
  time,
  today,
}: {
  reading: ActivityLogEntryReading;
  /** Newest first, as the log holds them. */
  logs: ActivityLogEntry[];
  time?: number;
  today: number;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const stretch = logs[0]!.type === "move_completed";
  const rhythm = stretch ? readRhythm(logs) : undefined;
  const rhythmWords = rhythm && describeRhythm(rhythm, today);
  const tasksListed = open && !stretch;
  const shown = tasksListed
    ? { ...reading, action: `Added ${logs.length} Tasks`, subject: undefined }
    : reading;

  return (
    <li className={cn("relative flex gap-3 py-1", OPENABLE_LINE_HOVER)}>
      <BareNode icon={reading.icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            onClick={() => setOpen((current) => !current)}
            className={cn(
              "min-w-0 flex-1 text-left text-xs leading-snug wrap-anywhere outline-none after:absolute after:rounded-lg",
              // Open, the overlay covers only this row, so the days below still
              // get hover and their titles.
              open ? "after:inset-x-0 after:top-0 after:h-7" : "after:inset-0",
            )}
          >
            <span className="sr-only">{reading.label}: </span>
            <Sentence
              reading={shown}
              trailing={
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "ml-1 inline size-3 -translate-y-px text-muted-foreground transition-transform motion-reduce:transition-none",
                    open && "rotate-180",
                  )}
                />
              }
            />
          </button>
          {time !== undefined && <Time at={time} />}
        </div>
        {rhythmWords !== undefined && (
          <p className="text-[11px] leading-snug text-muted-foreground/80">
            {rhythmWords}
          </p>
        )}
        {open && (
          <div id={id} className="pt-1 pb-1">
            {rhythm ? (
              <StretchDays rhythm={rhythm} today={today} />
            ) : (
              <AddedTasks logs={logs} />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function StretchDays({ rhythm, today }: { rhythm: Rhythm; today: number }) {
  const times = new Map<number, number[]>();
  for (const at of rhythm.times) {
    const day = startOfDay(at).getTime();
    times.set(day, [...(times.get(day) ?? []), at]);
  }
  const marked = [
    ...rhythm.days.map((day) => ({ day, done: true })),
    ...rhythm.quiet.map((day) => ({ day, done: false })),
  ].sort((a, b) => a.day - b.day);
  const months = new Map<string, typeof marked>();
  for (const mark of marked) {
    const key = format(mark.day, "yyyy-MM");
    months.set(key, [...(months.get(key) ?? []), mark]);
  }

  return (
    <ol className="flex flex-col gap-1 text-xs">
      {[...months].map(([key, days]) => {
        const first = days[0]!.day;
        return (
          <li key={key} className="flex gap-2">
            <span className="w-16 shrink-0 pt-0.5 text-muted-foreground">
              {format(first, isSameYear(first, today) ? "MMMM" : "MMM yyyy")}
            </span>
            <ol className="flex flex-wrap gap-x-1 gap-y-0.5 tabular-nums">
              {days.map(({ day, done }) => {
                const when = (times.get(day) ?? []).map((at) =>
                  format(at, "h:mm a"),
                );
                return (
                  <li key={day}>
                    <time
                      dateTime={format(day, "yyyy-MM-dd")}
                      title={`${shortDay(day, today)} · ${done ? when.join(", ") : "none"}`}
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded px-0.5",
                        done
                          ? "text-foreground/75"
                          : "border border-dashed border-muted-foreground/50 text-muted-foreground",
                        when.length > 1 && "font-semibold",
                      )}
                    >
                      {format(day, "d")}
                      <span className="sr-only">
                        {done ? ` at ${when.join(" and ")}` : ", none"}
                      </span>
                    </time>
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

function AddedTasks({ logs }: { logs: ActivityLogEntry[] }) {
  const timesDiffer =
    new Set(logs.map((log) => format(log.createdAt, "yyyy-MM-dd HH:mm"))).size >
    1;
  return (
    <ol className="flex flex-col gap-1">
      {[...logs].reverse().map((log) => (
        <li key={log._id} className="flex items-baseline gap-3 text-xs">
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <span className="min-w-0 flex-1 leading-snug wrap-anywhere text-foreground/75">
            {readActivityLogEntry(log).subject}
          </span>
          {timesDiffer && <Time at={log.createdAt} />}
        </li>
      ))}
    </ol>
  );
}
