// PROTOTYPE — throwaway. Variant B1 "Left dates": the timeline rail from
// Variant B, with day labels moved into a narrow left gutter so the rail
// divides dates (left) from content (right).
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

import { Field, FieldGroup, FieldLabel } from "@vita-os/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { format, isToday, isYesterday } from "date-fns";
import { ArrowUp } from "lucide-react";

import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { cn } from "@/lib/utils";

import {
  ACTIVITY_LOG_ICONS,
  type ActivityLogEntry,
  type ActivityLogVariantProps,
  type AutomaticActivityLogEntry,
  formatTime,
  formatTimeTitle,
  getAutomaticChangeSummary,
  getDayLabel,
  groupLogsByDay,
  isAutomaticActivityLogEntry,
  useNoteComposer,
} from "./shared";

// Rail geometry, shifted right past a 3.5rem date gutter: the 1px line spans
// left 56–57px, so its center is 56.5px. Nodes use NODE_LEFT with
// -translate-x-1/2 to center exactly on the line.
const RAIL_LEFT = "left-14";
const NODE_LEFT = "left-[56.5px]";
const ENTRY_PAD = "pl-[81px]";
// The gutter label: right-aligned in the space left of the rail, with a small
// gap before the line.
const GUTTER_LABEL =
  "absolute left-0 w-[46px] text-right text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase";

/** Compact day label that fits the gutter: "Today"/"Yesterday" as-is, full
 *  dates abbreviated to "Jul 24" (the full label goes in a title attribute). */
function getGutterDayLabel(createdAt: number) {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

export function ActivityLogRailLeftDates({
  logs,
  onAddNote,
}: ActivityLogVariantProps) {
  const { noteText, setNoteText, submitNote, isPending } =
    useNoteComposer(onAddNote);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitNote();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitNote();
    }
  };

  return (
    <section className="flex flex-col gap-1">
      <h2 className="mb-2.5 text-[11px] font-medium text-muted-foreground">
        Activity log
      </h2>

      <div className="relative">
        {/* The continuous rail: fades in at the top (the "now" origin) and
            fades out at the bottom past the oldest entry. */}
        <div
          aria-hidden
          className={cn(
            "absolute top-1 bottom-0 w-px",
            RAIL_LEFT,
            "bg-gradient-to-b from-transparent via-border to-transparent",
          )}
        />

        {/* Composer — the "now" node at the rail's origin, with a tiny "Now"
            caption in the gutter beside it. */}
        <div className={cn("relative pb-5", ENTRY_PAD)}>
          <span aria-hidden className={cn(GUTTER_LABEL, "top-[13px]")}>
            Now
          </span>
          <span
            aria-hidden
            className={cn(
              "absolute top-[15px] size-2.5 -translate-x-1/2 rounded-full",
              NODE_LEFT,
              "border border-(--brand-gold) bg-background",
            )}
          >
            <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
          </span>
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-0">
              <Field data-disabled={isPending || undefined}>
                <FieldLabel
                  htmlFor="activity-log-rail-left-dates-note"
                  className="sr-only"
                >
                  Activity log note
                </FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    id="activity-log-rail-left-dates-note"
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    disabled={isPending}
                    aria-label="Activity log note"
                    placeholder="Add a note about what happened…"
                    className="min-h-10 pr-10 py-2 text-[13px]"
                    rows={1}
                    onKeyDown={handleKeyDown}
                  />
                  <InputGroupAddon
                    align="block-end"
                    className="absolute right-2 bottom-2 w-auto p-0"
                  >
                    <InputGroupButton
                      type="submit"
                      size="icon-xs"
                      variant="secondary"
                      disabled={!noteText.trim() || isPending}
                      aria-label="Add note"
                      aria-busy={isPending}
                    >
                      <ArrowUp data-icon="inline-start" />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </FieldGroup>
          </form>
        </div>

        <RailBody logs={logs} />
      </div>
    </section>
  );
}

function RailBody({ logs }: { logs: ActivityLogEntry[] | undefined }) {
  if (logs === undefined) return <RailSkeleton />;

  if (logs.length === 0) {
    return (
      <div className={cn("relative pb-2", ENTRY_PAD)}>
        <span
          aria-hidden
          className={cn(
            "absolute top-1 size-2 -translate-x-1/2 rounded-full border border-border bg-background",
            NODE_LEFT,
          )}
        />
        <p className="text-[13px] leading-snug text-muted-foreground">
          Nothing on the timeline yet — the first note starts this Thread's
          continuity record.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {groupLogsByDay(logs).map((group) => (
        <section
          key={group.key}
          aria-label={group.label}
          className="flex flex-col pt-4 first:pt-0"
        >
          {group.logs.map((log, index) => {
            const dayMarker =
              index === 0 ? (
                <DayMarker createdAt={group.logs[0]!.createdAt} />
              ) : null;
            return isAutomaticActivityLogEntry(log) ? (
              <AutomaticTick key={log._id} log={log} dayMarker={dayMarker} />
            ) : (
              <NoteCard key={log._id} log={log} dayMarker={dayMarker} />
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Day label in the gutter, left of the rail. The wrapping entry positions it
 *  so it aligns with the first entry of its day group. */
function DayMarker({ createdAt }: { createdAt: number }) {
  return (
    <h3 className={GUTTER_LABEL} title={getDayLabel(createdAt)}>
      {getGutterDayLabel(createdAt)}
    </h3>
  );
}

/** A note: gold filled node + raised card body. */
function NoteCard({
  log,
  dayMarker,
}: {
  log: ActivityLogEntry;
  dayMarker?: ReactNode;
}) {
  return (
    <div className={cn("relative py-1.5", ENTRY_PAD)}>
      {dayMarker ? (
        <div className="absolute inset-x-0 top-3.5">{dayMarker}</div>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "absolute top-4 size-2.5 -translate-x-1/2 rounded-full",
          NODE_LEFT,
          "border border-(--brand-gold)/60 bg-(--brand-gold)",
          "ring-2 ring-background",
        )}
      />
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-medium tracking-wide text-(--brand-gold) uppercase">
            Note
          </span>
          <EntryTime createdAt={log.createdAt} />
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
          {log.content}
        </p>
      </div>
    </div>
  );
}

/** An automatic change: tiny hollow node, single compact muted line. */
function AutomaticTick({
  log,
  dayMarker,
}: {
  log: AutomaticActivityLogEntry;
  dayMarker?: ReactNode;
}) {
  const Icon = ACTIVITY_LOG_ICONS[log.type];

  return (
    <div className={cn("relative py-1", ENTRY_PAD)}>
      {dayMarker ? (
        <div className="absolute inset-x-0 top-[7px]">{dayMarker}</div>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "absolute top-[9px] size-1.5 -translate-x-1/2 rounded-full border border-muted-foreground/40 bg-background",
          NODE_LEFT,
        )}
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="shrink-0 font-medium">
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="truncate text-muted-foreground/80">
          {getAutomaticChangeSummary(log)}
        </span>
        <span className="ml-auto shrink-0 pl-2">
          <EntryTime createdAt={log.createdAt} />
        </span>
      </div>
    </div>
  );
}

function EntryTime({ createdAt }: { createdAt: number }) {
  return (
    <time
      dateTime={new Date(createdAt).toISOString()}
      title={formatTimeTitle(createdAt)}
      className="shrink-0 text-[10px] text-muted-foreground/60"
    >
      {formatTime(createdAt)}
    </time>
  );
}

function RailSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading activity log">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={cn("relative", ENTRY_PAD)}>
          <Skeleton className="absolute top-1 left-3 h-3 w-9 rounded-sm" />
          <Skeleton
            className={cn(
              "absolute top-1 size-2 -translate-x-1/2 rounded-full",
              NODE_LEFT,
            )}
          />
          <Skeleton className={index % 2 === 0 ? "h-12 w-full" : "h-4 w-2/3"} />
        </div>
      ))}
    </div>
  );
}
