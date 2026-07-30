// PROTOTYPE — throwaway. Variant C "Ledger": hierarchy through a dense
// time-gutter grid, per-type color-coding, and filter chips instead of decoration.
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

/** Muted color accent per automatic-change category for the type label. */
const TYPE_LABEL_CLASSES: Partial<
  Record<AutomaticActivityLogEntry["type"], string>
> = {
  status_change: "text-sky-700 dark:text-sky-400/80",
  state_change: "text-sky-700 dark:text-sky-400/80",
  next_action_change: "text-emerald-700 dark:text-emerald-400/80",
  waiting_change: "text-amber-700 dark:text-amber-400/80",
  follow_up_change: "text-amber-700 dark:text-amber-400/80",
};

export function ActivityLogLedger({
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
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-medium text-muted-foreground">
        Activity log
      </h2>

      <LedgerComposer onAddNote={onAddNote} />

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

      <LedgerBody logs={filteredLogs} filter={filter} />
    </section>
  );
}

function LedgerComposer({
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
    <form onSubmit={handleSubmit}>
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
    </form>
  );
}

function LedgerBody({
  logs,
  filter,
}: {
  logs: ActivityLogEntry[] | undefined;
  filter: LedgerFilter;
}) {
  if (logs === undefined) return <LedgerSkeleton />;

  if (logs.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        {EMPTY_FILTER_MESSAGES[filter]}
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/50 border-y border-border/50">
      {groupLogsByDay(logs).map((group) => (
        <div key={group.key} className="divide-y divide-border/50">
          <div className="bg-muted/30 px-1 py-1 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
            {group.label}
          </div>
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
        </div>
      ))}
    </div>
  );
}

function TimeGutter({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt);

  return (
    <time
      dateTime={date.toISOString()}
      title={formatTimeTitle(createdAt)}
      className="pt-px pr-2 text-right text-[11px] tabular-nums text-muted-foreground/60"
    >
      {formatTime(createdAt)}
    </time>
  );
}

function NoteRow({ log }: { log: ActivityLogEntry }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] py-1.5">
      <TimeGutter createdAt={log.createdAt} />
      <p className="border-l-2 border-l-(--brand-gold) bg-(--brand-gold)/5 py-0.5 pl-2 whitespace-pre-wrap text-[13px] leading-snug text-foreground">
        {log.content}
      </p>
    </div>
  );
}

function DecisionRow({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] py-1.5">
      <TimeGutter createdAt={log.createdAt} />
      <div className="flex items-baseline gap-1.5 pl-0.5">
        <Scale
          aria-hidden
          className="size-3 shrink-0 self-center text-muted-foreground"
        />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="text-xs font-medium leading-snug text-foreground/90">
          {getAutomaticChangeSummary(log)}
        </span>
      </div>
    </div>
  );
}

function ChangeRow({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] py-1.5">
      <TimeGutter createdAt={log.createdAt} />
      <div className="flex items-baseline gap-1.5 pl-0.5">
        <span
          className={cn(
            "shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase",
            TYPE_LABEL_CLASSES[log.type],
          )}
        >
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="min-w-0 text-xs leading-snug text-muted-foreground">
          {getAutomaticChangeSummary(log)}
        </span>
      </div>
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-1" aria-label="Loading activity log">
      <Skeleton className="h-4 w-20" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[3.5rem_1fr] gap-2">
          <Skeleton className="h-3 w-10 justify-self-end" />
          <Skeleton className={cn("h-3", index % 2 ? "w-3/4" : "w-1/2")} />
        </div>
      ))}
    </div>
  );
}
