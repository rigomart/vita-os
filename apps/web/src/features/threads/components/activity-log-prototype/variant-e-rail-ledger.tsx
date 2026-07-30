// PROTOTYPE — throwaway. Variant E "Rail ledger": the ledger's strict
// [time | node | body] grid with the rail's continuous spine running through
// the node column, so table discipline and timeline continuity are one structure.
import type { FormEvent, KeyboardEvent } from "react";

import { Button } from "@vita-os/ui/components/button";
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

import type {
  ActivityLogEntry,
  ActivityLogVariantProps,
  AutomaticActivityLogEntry,
} from "./shared";

import {
  formatTime,
  formatTimeTitle,
  getAutomaticChangeSummary,
  groupLogsByDay,
  isAutomaticActivityLogEntry,
  useNoteComposer,
} from "./shared";

// Every row obeys this grid: right-aligned time gutter, node column the rail
// runs through, then the body. The rail sits at the node column's center:
// 3.25rem gutter + half of the 1rem node column = 3.75rem.
const ROW_GRID = "grid grid-cols-[3.25rem_1rem_1fr]";
const RAIL_X = "left-[3.75rem]";

type LedgerFilter = "all" | "notes" | "decisions" | "changes";

const FILTERS: { id: LedgerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "decisions", label: "Decisions" },
  { id: "changes", label: "Changes" },
];

const EMPTY_FILTER_MESSAGES: Record<LedgerFilter, string> = {
  all: "No activity yet — log a note to start the record.",
  notes: "No notes yet.",
  decisions: "No decisions logged yet.",
  changes: "No system changes yet.",
};

function filterCategory(log: ActivityLogEntry): Exclude<LedgerFilter, "all"> {
  if (log.type === "note") return "notes";
  if (log.type === "decision") return "decisions";
  return "changes";
}

export function ActivityLogRailLedger({
  logs,
  onAddNote,
}: ActivityLogVariantProps) {
  const [filter, setFilter] = useState<LedgerFilter>("all");

  const counts: Record<LedgerFilter, number> = {
    all: logs?.length ?? 0,
    notes: 0,
    decisions: 0,
    changes: 0,
  };
  for (const log of logs ?? []) counts[filterCategory(log)] += 1;

  const filteredLogs = logs?.filter(
    (log) => filter === "all" || filterCategory(log) === filter,
  );

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[11px] font-medium text-muted-foreground">
        Activity log
      </h2>

      <div
        role="group"
        aria-label="Filter activity log"
        className="flex flex-wrap items-center gap-1"
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

      <div className="relative">
        {/* The spine: one continuous hairline behind every node, fading in at
            the composer's "now" origin and out past the oldest entry. */}
        <div
          aria-hidden
          className={cn(
            "absolute top-2 bottom-0 w-px -translate-x-1/2",
            RAIL_X,
            "bg-gradient-to-b from-transparent via-border to-transparent",
          )}
        />

        <ComposerRow onAddNote={onAddNote} />
        <LedgerRailBody logs={filteredLogs} filter={filter} />
      </div>
    </section>
  );
}

/** Composer aligned to the same grid — its gold node is the rail's "now". */
function ComposerRow({
  onAddNote,
}: {
  onAddNote: ActivityLogVariantProps["onAddNote"];
}) {
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
    <form onSubmit={handleSubmit} className={cn(ROW_GRID, "pb-3")}>
      <span className="self-center pr-2 text-right text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
        Now
      </span>
      <span aria-hidden className="relative">
        <span
          className={cn(
            "absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "border border-(--brand-gold) bg-background ring-2 ring-background",
          )}
        >
          <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
        </span>
      </span>
      <div className="pl-2">
        <InputGroup>
          <InputGroupTextarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            aria-label="Log a note"
            placeholder="Log a note…"
            rows={1}
            className="min-h-8 py-1.5 pr-9 text-[13px]"
          />
          <InputGroupAddon
            align="block-end"
            className="absolute right-1.5 bottom-1.5 w-auto p-0"
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
      </div>
    </form>
  );
}

function LedgerRailBody({
  logs,
  filter,
}: {
  logs: ActivityLogEntry[] | undefined;
  filter: LedgerFilter;
}) {
  if (logs === undefined) return <RailLedgerSkeleton />;

  if (logs.length === 0) {
    return (
      <div className={ROW_GRID}>
        <span />
        <NodeCell kind="empty" />
        <p className="pl-2 text-xs leading-snug text-muted-foreground">
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
          <DayDividerRow label={group.label} />
          {group.logs.map((log) =>
            isAutomaticActivityLogEntry(log) ? (
              log.type === "decision" ? (
                <DecisionRow key={log._id} log={log} />
              ) : (
                <ChangeRow key={log._id} log={log} />
              )
            ) : (
              <NoteRow key={log._id} log={log} />
            ),
          )}
        </section>
      ))}
    </div>
  );
}

/** Full-width divider row: hairline spans all three columns; the small-caps
 *  label sits in the body column so the rail deliberately passes through
 *  the node column uninterrupted. */
function DayDividerRow({ label }: { label: string }) {
  return (
    <div className={cn(ROW_GRID, "mt-1.5 border-t border-border/60 pb-1")}>
      <span />
      <span />
      <span className="pt-1 pl-2 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </span>
    </div>
  );
}

function TimeGutter({ createdAt }: { createdAt: number }) {
  return (
    <time
      dateTime={new Date(createdAt).toISOString()}
      title={formatTimeTitle(createdAt)}
      className="pt-px pr-2 text-right text-[11px] tabular-nums text-muted-foreground/60"
    >
      {formatTime(createdAt)}
    </time>
  );
}

/** Node column cell: a dot centered on the rail; ring-2 ring-background makes
 *  the line read as passing behind it. */
function NodeCell({
  kind,
}: {
  kind: "note" | "decision" | "change" | "empty";
}) {
  return (
    <span aria-hidden className="relative">
      <span
        className={cn(
          "absolute top-[7px] left-1/2 -translate-x-1/2 rounded-full ring-2 ring-background",
          kind === "note" &&
            "size-2 border border-(--brand-gold)/60 bg-(--brand-gold)",
          kind === "decision" &&
            "size-2 border border-foreground/50 bg-background",
          kind === "change" &&
            "size-1.5 border border-muted-foreground/40 bg-background",
          kind === "empty" &&
            "size-1.5 border border-muted-foreground/40 bg-background",
        )}
      />
    </span>
  );
}

/** Notes are the loud register: full foreground text on a faint gold tint. */
function NoteRow({ log }: { log: ActivityLogEntry }) {
  return (
    <div className={cn(ROW_GRID, "py-1.5")}>
      <TimeGutter createdAt={log.createdAt} />
      <NodeCell kind="note" />
      <p className="ml-2 rounded-sm bg-(--brand-gold)/5 px-1.5 py-0.5 whitespace-pre-wrap text-[13px] leading-snug text-foreground">
        {log.content}
      </p>
    </div>
  );
}

/** Decisions sit between: medium weight with the Scale icon. */
function DecisionRow({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className={cn(ROW_GRID, "py-1")}>
      <TimeGutter createdAt={log.createdAt} />
      <NodeCell kind="decision" />
      <div className="flex min-w-0 items-baseline gap-1.5 pl-2">
        <Scale
          aria-hidden
          className="size-3 shrink-0 self-center text-muted-foreground"
        />
        <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="min-w-0 text-xs font-medium leading-snug text-foreground/90">
          {getAutomaticChangeSummary(log)}
        </span>
      </div>
    </div>
  );
}

/** Automatic changes are one quiet line: type label + summary. */
function ChangeRow({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className={cn(ROW_GRID, "py-1")}>
      <TimeGutter createdAt={log.createdAt} />
      <NodeCell kind="change" />
      <div className="flex min-w-0 items-baseline gap-1.5 pl-2">
        <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="min-w-0 truncate text-xs leading-snug text-muted-foreground">
          {getAutomaticChangeSummary(log)}
        </span>
      </div>
    </div>
  );
}

function RailLedgerSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-label="Loading activity log">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className={ROW_GRID}>
          <Skeleton className="mr-2 h-3 w-10 justify-self-end" />
          <Skeleton className="size-2 justify-self-center rounded-full" />
          <Skeleton
            className={cn("ml-2 h-3", index % 2 === 0 ? "w-3/4" : "w-1/2")}
          />
        </div>
      ))}
    </div>
  );
}
