// PROTOTYPE — throwaway. Variant B3 "Soft styling": variant-b-rail restyled —
// solid quiet rail, borderless kicker-less note cards, icon-less ticks, softer
// day labels. Structure and geometry unchanged.
import type { FormEvent, KeyboardEvent } from "react";

import { Field, FieldGroup, FieldLabel } from "@vita-os/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { ArrowUp } from "lucide-react";

import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { cn } from "@/lib/utils";

import {
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

// Rail geometry: the 1px line spans left 11–12px, so its center is 11.5px.
// Nodes use NODE_LEFT with -translate-x-1/2 to center exactly on the line.
const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ENTRY_PAD = "pl-9";

export function ActivityLogRailSoft({
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
        {/* The continuous rail: a single solid quiet line. */}
        <div
          aria-hidden
          className={cn(
            "absolute top-1 bottom-0 w-px",
            RAIL_LEFT,
            "bg-border/70",
          )}
        />

        {/* Composer — the "now" node at the rail's origin. */}
        <div className={cn("relative pb-5", ENTRY_PAD)}>
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
                  htmlFor="activity-log-rail-soft-note"
                  className="sr-only"
                >
                  Activity log note
                </FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    id="activity-log-rail-soft-note"
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
          className="flex flex-col"
        >
          <DayMarker label={group.label} />
          {group.logs.map((log) =>
            isAutomaticActivityLogEntry(log) ? (
              <AutomaticTick key={log._id} log={log} />
            ) : (
              <NoteCard key={log._id} log={log} />
            ),
          )}
        </section>
      ))}
    </div>
  );
}

/** Day label to the right of the rail, directly above its log items; the
 *  rail runs through uninterrupted. */
function DayMarker({ label }: { label: string }) {
  return (
    <div className={cn("pt-5 pb-1.5 first:pt-0", ENTRY_PAD)}>
      <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
        {label}
      </h3>
    </div>
  );
}

/** A note: gold filled node + soft borderless card, time floated top-right. */
function NoteCard({ log }: { log: ActivityLogEntry }) {
  return (
    <div className={cn("relative py-1.5", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-4 size-2.5 -translate-x-1/2 rounded-full",
          NODE_LEFT,
          "border border-(--brand-gold)/60 bg-(--brand-gold)",
          "ring-2 ring-background",
        )}
      />
      <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
        <div className="mb-1 flex items-baseline justify-end">
          <EntryTime createdAt={log.createdAt} />
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
          {log.content}
        </p>
      </div>
    </div>
  );
}

/** An automatic change: tiny hollow node, single quiet icon-less line. */
function AutomaticTick({ log }: { log: AutomaticActivityLogEntry }) {
  return (
    <div className={cn("relative py-1", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[9px] size-1.5 -translate-x-1/2 rounded-full border border-muted-foreground/40 bg-background",
          NODE_LEFT,
        )}
      />
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0 font-medium text-muted-foreground/90">
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="truncate text-muted-foreground/70">
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
