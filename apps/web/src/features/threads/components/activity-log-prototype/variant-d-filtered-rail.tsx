// PROTOTYPE — throwaway. Variant D "Filtered rail": B's continuous spatial
// rail matured with C's filter chips — same timeline metaphor, tighter density,
// aligned nodes and timestamps, decisions given the weight the user gives them.
import type { FormEvent, KeyboardEvent } from "react";

import { Button } from "@vita-os/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@vita-os/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { ArrowUp, Scale } from "lucide-react";
import { useState } from "react";

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
  groupLogsByDay,
  isAutomaticActivityLogEntry,
  useNoteComposer,
} from "./shared";

// Rail geometry: the line sits at this x-offset; entries pad past it. Every
// node is absolutely positioned on RAIL_LEFT so vertical alignment is exact.
const RAIL_LEFT = "left-[11px]";
const ENTRY_PAD = "pl-8";

type RailFilter = "all" | "notes" | "decisions" | "changes";

const FILTERS: { id: RailFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "decisions", label: "Decisions" },
  { id: "changes", label: "Changes" },
];

const EMPTY_FILTER_MESSAGES: Record<RailFilter, string> = {
  all: "Nothing on the timeline yet — the first note starts this Thread's continuity record.",
  notes: "No notes on the timeline yet.",
  decisions: "No decisions logged yet.",
  changes: "No system changes yet.",
};

function filterCategory(log: ActivityLogEntry): Exclude<RailFilter, "all"> {
  if (log.type === "note") return "notes";
  if (log.type === "decision") return "decisions";
  return "changes";
}

export function ActivityLogFilteredRail({
  logs,
  onAddNote,
}: ActivityLogVariantProps) {
  const [filter, setFilter] = useState<RailFilter>("all");
  const { noteText, setNoteText, submitNote, isPending } =
    useNoteComposer(onAddNote);

  const counts: Record<RailFilter, number> = {
    all: logs?.length ?? 0,
    notes: 0,
    decisions: 0,
    changes: 0,
  };
  for (const log of logs ?? []) counts[filterCategory(log)] += 1;

  const filteredLogs = logs?.filter(
    (log) => filter === "all" || filterCategory(log) === filter,
  );

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
    <section className="flex flex-col">
      <h2 className="mb-2.5 text-[11px] font-medium text-muted-foreground">
        Activity log
      </h2>

      <div className="relative">
        {/* The continuous rail: fades in at the "now" origin and out past the
            oldest entry. It spans composer, chips, and entries so the filter
            never breaks spatial continuity. */}
        <div
          aria-hidden
          className={cn(
            "absolute top-1 bottom-0 w-px",
            RAIL_LEFT,
            "bg-gradient-to-b from-transparent via-border to-transparent",
          )}
        />

        {/* Composer — the gold "now" node at the rail's origin. */}
        <div className={cn("relative pb-3", ENTRY_PAD)}>
          <span
            aria-hidden
            className={cn(
              "absolute top-3.5 size-2.5 -translate-x-1/2 rounded-full",
              RAIL_LEFT,
              "border border-(--brand-gold) bg-background",
            )}
          >
            <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
          </span>
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-0">
              <Field data-disabled={isPending || undefined}>
                <FieldLabel
                  htmlFor="activity-log-filtered-rail-note"
                  className="sr-only"
                >
                  Activity log note
                </FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    id="activity-log-filtered-rail-note"
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    disabled={isPending}
                    aria-label="Activity log note"
                    placeholder="Add a note about what happened…"
                    className="min-h-10 py-2 pr-10 text-[13px]"
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

        {/* Filter chips hang off the rail between composer and entries. */}
        <div
          role="group"
          aria-label="Filter activity log"
          className={cn(
            "relative flex flex-wrap items-center gap-1 pb-3",
            ENTRY_PAD,
          )}
        >
          {FILTERS.map(({ id, label }) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              size="xs"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "h-6 gap-1 rounded-full border border-transparent px-2.5 text-[11px] font-normal text-muted-foreground",
                filter === id &&
                  "border-border bg-muted font-medium text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "text-[10px] tabular-nums text-muted-foreground/60",
                  filter === id && "text-muted-foreground",
                )}
              >
                {counts[id]}
              </span>
            </Button>
          ))}
        </div>

        <RailBody logs={filteredLogs} filter={filter} />
      </div>
    </section>
  );
}

function RailBody({
  logs,
  filter,
}: {
  logs: ActivityLogEntry[] | undefined;
  filter: RailFilter;
}) {
  if (logs === undefined) return <RailSkeleton />;

  if (logs.length === 0) {
    return (
      <div className={cn("relative pb-2", ENTRY_PAD)}>
        <span
          aria-hidden
          className={cn(
            "absolute top-[7px] size-1.5 -translate-x-1/2 rounded-full border border-muted-foreground/40 bg-background",
            RAIL_LEFT,
          )}
        />
        <p className="text-xs leading-snug text-muted-foreground">
          {EMPTY_FILTER_MESSAGES[filter]}
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
          className="flex flex-col"
        >
          <DayMarker label={group.label} />
          {group.logs.map((log) =>
            isAutomaticActivityLogEntry(log) ? (
              log.type === "decision" ? (
                <DecisionRow key={log._id} log={log} />
              ) : (
                <AutomaticTick key={log._id} log={log} />
              )
            ) : (
              <NoteCard key={log._id} log={log} />
            ),
          )}
        </section>
      ))}
    </div>
  );
}

/** Small pill sitting ON the rail; its bg-background makes the line appear
 *  to pass behind it. */
function DayMarker({ label }: { label: string }) {
  return (
    <div className="relative flex items-center py-2">
      <span
        className={cn(
          "absolute -translate-x-1/2 rounded-full border border-border bg-background",
          RAIL_LEFT,
          "px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase whitespace-nowrap",
        )}
      >
        {label}
      </span>
      {/* Reserve vertical space for the absolutely positioned pill. */}
      <span className="invisible px-2 py-0.5 text-[10px] uppercase">
        {label}
      </span>
    </div>
  );
}

/** A note: gold filled node + raised card body. Gold stays reserved for
 *  notes and the now-node. */
function NoteCard({ log }: { log: ActivityLogEntry }) {
  return (
    <div className={cn("relative py-1", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[13px] size-2.5 -translate-x-1/2 rounded-full",
          RAIL_LEFT,
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

/** A decision: same compact one-liner form as other automatic changes, but
 *  slightly emphasized — Scale icon at foreground tone, medium-weight text. */
function DecisionRow({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className={cn("relative py-1", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[11px] size-1.5 -translate-x-1/2 rounded-full border border-foreground/50 bg-background",
          RAIL_LEFT,
        )}
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs">
        <Scale
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="shrink-0 font-medium text-muted-foreground">
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="truncate font-medium text-foreground/90">
          {getAutomaticChangeSummary(log)}
        </span>
        <span className="ml-auto shrink-0 pl-2">
          <EntryTime createdAt={log.createdAt} />
        </span>
      </div>
    </div>
  );
}

/** An automatic change: tiny hollow node, single compact muted line,
 *  timestamp right-aligned to match note cards and decisions. */
function AutomaticTick({ log }: { log: AutomaticActivityLogEntry }) {
  const Icon = ACTIVITY_LOG_ICONS[log.type];

  return (
    <div className={cn("relative py-1", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[11px] size-1.5 -translate-x-1/2 rounded-full border border-muted-foreground/40 bg-background",
          RAIL_LEFT,
        )}
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground/60"
        />
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
      className="shrink-0 text-right text-[10px] tabular-nums text-muted-foreground/60"
    >
      {formatTime(createdAt)}
    </time>
  );
}

function RailSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-label="Loading activity log">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={cn("relative", ENTRY_PAD)}>
          <Skeleton
            className={cn(
              "absolute top-1 size-2 -translate-x-1/2 rounded-full",
              RAIL_LEFT,
            )}
          />
          <Skeleton className={index % 2 === 0 ? "h-12 w-full" : "h-4 w-2/3"} />
        </div>
      ))}
    </div>
  );
}
