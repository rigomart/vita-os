// PROTOTYPE — throwaway. Variant F "Day digest": the day is the primary unit —
// bordered day sections with per-day summaries; notes are first-class, runs of
// automatic changes roll up into expandable one-line digests.
import type { FormEvent, KeyboardEvent } from "react";

import { Button } from "@vita-os/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { ArrowUp, ChevronRight, Scale } from "lucide-react";
import { useState } from "react";

import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { cn } from "@/lib/utils";

import type {
  ActivityLogEntry,
  ActivityLogVariantProps,
  AutomaticActivityLogEntry,
} from "./shared";

import {
  ACTIVITY_LOG_ICONS,
  formatTime,
  formatTimeTitle,
  getAutomaticChangeSummary,
  groupLogsByDay,
  isAutomaticActivityLogEntry,
  useNoteComposer,
} from "./shared";

type DigestFilter = "all" | "notes" | "decisions" | "changes";

const FILTERS: { id: DigestFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "decisions", label: "Decisions" },
  { id: "changes", label: "Changes" },
];

const EMPTY_FILTER_MESSAGES: Record<Exclude<DigestFilter, "all">, string> = {
  notes: "No notes match this filter.",
  decisions: "No decisions match this filter.",
  changes: "No system changes match this filter.",
};

function filterCategory(log: ActivityLogEntry): Exclude<DigestFilter, "all"> {
  if (log.type === "note") return "notes";
  if (log.type === "decision") return "decisions";
  return "changes";
}

/** Day-local items: decisions never roll up; runs of other automatic changes
 *  collapse into a digest. Notes stay first-class in chronological position. */
type DayItem =
  | { kind: "note"; log: ActivityLogEntry }
  | { kind: "decision"; log: AutomaticActivityLogEntry }
  | { kind: "change"; log: AutomaticActivityLogEntry }
  | { kind: "digest"; logs: AutomaticActivityLogEntry[] };

function buildDayItems(logs: ActivityLogEntry[]): DayItem[] {
  const items: DayItem[] = [];
  let run: AutomaticActivityLogEntry[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    items.push(
      run.length === 1
        ? { kind: "change", log: run[0]! }
        : { kind: "digest", logs: run },
    );
    run = [];
  };

  for (const log of logs) {
    if (!isAutomaticActivityLogEntry(log)) {
      flushRun();
      items.push({ kind: "note", log });
    } else if (log.type === "decision") {
      flushRun();
      items.push({ kind: "decision", log });
    } else {
      run.push(log);
    }
  }
  flushRun();

  return items;
}

function daySummary(logs: ActivityLogEntry[]) {
  const counts = { notes: 0, decisions: 0, changes: 0 };
  for (const log of logs) counts[filterCategory(log)] += 1;

  const parts: string[] = [];
  if (counts.notes > 0) {
    parts.push(`${counts.notes} ${counts.notes === 1 ? "note" : "notes"}`);
  }
  if (counts.decisions > 0) {
    parts.push(
      `${counts.decisions} ${counts.decisions === 1 ? "decision" : "decisions"}`,
    );
  }
  if (counts.changes > 0) {
    parts.push(
      `${counts.changes} ${counts.changes === 1 ? "change" : "changes"}`,
    );
  }
  return parts.join(" · ");
}

export function ActivityLogDayDigest({
  logs,
  onAddNote,
}: ActivityLogVariantProps) {
  const [filter, setFilter] = useState<DigestFilter>("all");

  const counts: Record<DigestFilter, number> = {
    all: logs?.length ?? 0,
    notes: 0,
    decisions: 0,
    changes: 0,
  };
  for (const log of logs ?? []) counts[filterCategory(log)] += 1;

  const filteredLogs = logs?.filter(
    (log) => filter === "all" || filterCategory(log) === filter,
  );

  const groups = filteredLogs ? groupLogsByDay(filteredLogs) : undefined;
  const todayGroup = groups?.find((group) => group.label === "Today");
  const pastGroups = groups?.filter((group) => group.label !== "Today") ?? [];
  const filteredToEmpty =
    logs !== undefined && logs.length > 0 && filteredLogs?.length === 0;

  return (
    <section className="flex flex-col gap-3">
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

      {/* Today section always exists: it hosts the composer, plus today's
          entries when there are any matching the filter. */}
      <DaySection
        label="Today"
        isToday
        summary={todayGroup ? daySummary(todayGroup.logs) : undefined}
      >
        <DigestComposer onAddNote={onAddNote} />
        {todayGroup && <DayBody logs={todayGroup.logs} />}
        {logs !== undefined && logs.length === 0 && (
          <p className="px-3 pb-3 text-xs text-muted-foreground">
            Nothing logged yet — write the first note above to start this
            Thread's record.
          </p>
        )}
      </DaySection>

      {logs === undefined && <DaySkeleton />}

      {filteredToEmpty && filter !== "all" && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {EMPTY_FILTER_MESSAGES[filter]}
        </p>
      )}

      {pastGroups.map((group) => (
        <DaySection
          key={group.key}
          label={group.label}
          summary={daySummary(group.logs)}
        >
          <DayBody logs={group.logs} />
        </DaySection>
      ))}
    </section>
  );
}

function DaySection({
  label,
  summary,
  isToday = false,
  children,
}: {
  label: string;
  summary?: string;
  isToday?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="overflow-hidden rounded-md border border-border"
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-border/60 bg-muted/20 px-3 py-1.5">
        <h3
          className={cn(
            "text-[10px] font-medium tracking-wide uppercase",
            isToday ? "text-(--brand-gold)" : "text-muted-foreground/80",
          )}
        >
          {label}
        </h3>
        {summary && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {summary}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function DigestComposer({
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
    <form onSubmit={handleSubmit} className="p-2">
      <InputGroup>
        <InputGroupTextarea
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          aria-label="Add a note to today's activity"
          placeholder="Add a note to today…"
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

function DayBody({ logs }: { logs: ActivityLogEntry[] }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 pt-1.5 pb-2.5">
      {buildDayItems(logs).map((item) => {
        switch (item.kind) {
          case "note":
            return <NoteBlock key={item.log._id} log={item.log} />;
          case "decision":
            return <DecisionLine key={item.log._id} log={item.log} />;
          case "change":
            return <ChangeLine key={item.log._id} log={item.log} />;
          case "digest":
            return <ChangeDigest key={item.logs[0]!._id} logs={item.logs} />;
        }
      })}
    </div>
  );
}

/** Notes are the day's first-class content: full text, small gold marker. */
function NoteBlock({ log }: { log: ActivityLogEntry }) {
  return (
    <div className="py-1">
      <div className="mb-0.5 flex items-baseline gap-1.5">
        <span
          aria-hidden
          className="size-1.5 shrink-0 self-center rounded-full bg-(--brand-gold)"
        />
        <EntryTime createdAt={log.createdAt} />
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
        {log.content}
      </p>
    </div>
  );
}

/** Decisions never roll up: always visible, Scale icon, medium weight. */
function DecisionLine({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 py-1 text-xs">
      <Scale aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {getActivityLogEntryLabel(log.type)}
      </span>
      <span className="min-w-0 truncate font-medium text-foreground/90">
        {getAutomaticChangeSummary(log)}
      </span>
      <span className="ml-auto shrink-0 pl-2">
        <EntryTime createdAt={log.createdAt} />
      </span>
    </div>
  );
}

/** A lone automatic change: one muted row, no rollup ceremony. */
function ChangeLine({ log }: { log: AutomaticActivityLogEntry }) {
  const Icon = ACTIVITY_LOG_ICONS[log.type];

  return (
    <div className="flex min-w-0 items-center gap-1.5 py-1 text-xs text-muted-foreground">
      <Icon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/60"
      />
      <span className="shrink-0 font-medium">
        {getActivityLogEntryLabel(log.type)}
      </span>
      <span className="min-w-0 truncate text-muted-foreground/80">
        {getAutomaticChangeSummary(log)}
      </span>
      <span className="ml-auto shrink-0 pl-2">
        <EntryTime createdAt={log.createdAt} />
      </span>
    </div>
  );
}

/** A run of automatic changes rolled into one expandable digest line. */
function ChangeDigest({ logs }: { logs: AutomaticActivityLogEntry[] }) {
  const uniqueTypes = [...new Set(logs.map((log) => log.type))];

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full min-w-0 items-center gap-1.5 rounded-sm py-1 text-left text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground/50 transition-transform group-data-[state=open]:rotate-90"
        />
        <span aria-hidden className="flex shrink-0 items-center gap-0.5">
          {uniqueTypes.slice(0, 4).map((type) => {
            const Icon = ACTIVITY_LOG_ICONS[type];
            return (
              <Icon key={type} className="size-3 text-muted-foreground/60" />
            );
          })}
        </span>
        <span className="font-medium">{logs.length} changes</span>
        <span className="ml-auto shrink-0 pl-2">
          <EntryTime createdAt={logs[0]!.createdAt} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col pl-[18px]">
          {logs.map((log) => (
            <ChangeLine key={log._id} log={log} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EntryTime({ createdAt }: { createdAt: number }) {
  return (
    <time
      dateTime={new Date(createdAt).toISOString()}
      title={formatTimeTitle(createdAt)}
      className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60"
    >
      {formatTime(createdAt)}
    </time>
  );
}

function DaySkeleton() {
  return (
    <div
      aria-label="Loading activity log"
      className="overflow-hidden rounded-md border border-border"
    >
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-3 py-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
