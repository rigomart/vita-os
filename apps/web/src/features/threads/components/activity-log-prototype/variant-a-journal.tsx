// PROTOTYPE — throwaway. Variant A "Journal": notes read as prose entries in a
// field journal; system changes collapse into quiet one-line footnotes.
import type { FormEvent, KeyboardEvent } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { ChevronRight } from "lucide-react";

import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { cn } from "@/lib/utils";

import type {
  ActivityLogEntry,
  ActivityLogVariantProps,
  AutomaticActivityLogEntry,
} from "./shared";

import {
  clusterLogs,
  formatTime,
  formatTimeTitle,
  getAutomaticChangeSummary,
  groupLogsByDay,
  useNoteComposer,
} from "./shared";

export function ActivityLogJournal({
  logs,
  onAddNote,
}: ActivityLogVariantProps) {
  return (
    <section className="flex flex-col gap-6">
      <JournalComposer onAddNote={onAddNote} />
      <JournalBody logs={logs} />
    </section>
  );
}

function JournalComposer({
  onAddNote,
}: Pick<ActivityLogVariantProps, "onAddNote">) {
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
    <form onSubmit={handleSubmit} className="group flex flex-col gap-1">
      <label htmlFor="journal-note" className="sr-only">
        Write today's entry
      </label>
      <textarea
        id="journal-note"
        value={noteText}
        onChange={(event) => setNoteText(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        rows={1}
        placeholder="Write today's entry…"
        className={cn(
          "field-sizing-content w-full resize-none border-b border-border bg-transparent pb-1.5",
          "text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60",
          "outline-none transition-colors focus:border-foreground/40 disabled:opacity-60",
        )}
      />
      <div className="flex h-5 items-center justify-end">
        <button
          type="submit"
          disabled={!noteText.trim() || isPending}
          aria-busy={isPending}
          className={cn(
            "text-[11px] text-muted-foreground/70 transition-opacity hover:text-foreground",
            noteText.trim() ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {isPending ? "Saving…" : "Add entry ↵"}
        </button>
      </div>
    </form>
  );
}

function JournalBody({ logs }: { logs: ActivityLogEntry[] | undefined }) {
  if (logs === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading activity log">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/70 italic">
        Nothing written yet — the first entry starts this Thread's record.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {groupLogsByDay(logs).map((group, groupIndex) => {
        const headingId = `journal-day-${group.key}`;
        const isCurrentDay = groupIndex === 0 && group.label === "Today";

        return (
          <section
            key={group.key}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <h3
                id={headingId}
                className={cn(
                  "font-heading text-[10px] font-semibold tracking-[0.14em] uppercase",
                  // Signature move: the current day's eyebrow carries the brand gold.
                  isCurrentDay ? "text-brand-gold" : "text-muted-foreground/70",
                )}
              >
                {group.label}
              </h3>
              <div
                className={cn(
                  "h-px flex-1",
                  isCurrentDay ? "bg-brand-gold/25" : "bg-border",
                )}
              />
            </div>

            <div className="flex flex-col gap-4">
              {clusterLogs(group.logs).map((cluster, clusterIndex) =>
                cluster.kind === "note" ? (
                  <JournalNote key={cluster.log._id} log={cluster.log} />
                ) : cluster.logs.length === 1 ? (
                  <ChangeRow
                    key={cluster.logs[0]!._id}
                    log={cluster.logs[0]!}
                  />
                ) : (
                  <ChangeCluster
                    key={`${group.key}-changes-${clusterIndex}`}
                    logs={cluster.logs}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function JournalNote({ log }: { log: ActivityLogEntry }) {
  return (
    <article className="flex flex-col gap-1">
      <time
        dateTime={new Date(log.createdAt).toISOString()}
        title={formatTimeTitle(log.createdAt)}
        className="text-[10px] tracking-wide text-muted-foreground/60"
      >
        {formatTime(log.createdAt)}
      </time>
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
        {log.content}
      </p>
    </article>
  );
}

function ChangeRow({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className="flex items-baseline gap-2 text-xs text-muted-foreground/80">
      <span className="shrink-0 font-medium text-muted-foreground">
        {getActivityLogEntryLabel(log.type)}
      </span>
      <span className="min-w-0 truncate" title={getAutomaticChangeSummary(log)}>
        {getAutomaticChangeSummary(log)}
      </span>
      <time
        dateTime={new Date(log.createdAt).toISOString()}
        title={formatTimeTitle(log.createdAt)}
        className="ml-auto shrink-0 text-[10px] text-muted-foreground/60"
      >
        {formatTime(log.createdAt)}
      </time>
    </div>
  );
}

function ChangeCluster({ logs }: { logs: AutomaticActivityLogEntry[] }) {
  const labels = [
    ...new Set(logs.map((log) => getActivityLogEntryLabel(log.type))),
  ];

  return (
    <Collapsible className="flex flex-col gap-1.5">
      <CollapsibleTrigger className="group flex items-center gap-1.5 self-start text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground">
        <ChevronRight className="size-3 transition-transform group-data-[panel-open]:rotate-90" />
        <span>
          {logs.length} updates · {labels.join(", ")}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1 pl-[18px]">
          {logs.map((log) => (
            <ChangeRow key={log._id} log={log} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
