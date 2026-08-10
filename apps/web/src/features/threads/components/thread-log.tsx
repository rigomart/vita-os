import type { Doc } from "@convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@vita-os/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format, isToday, isYesterday } from "date-fns";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  CircleCheck,
  Clock3,
  Link2,
  Loader2,
  MapPin,
  RefreshCw,
  Scale,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { cn } from "@/lib/utils";

interface ActivityLogProps {
  logs: Doc<"activityLogs">[] | undefined;
  onAddNote: (text: string) => Promise<void> | void;
  /** Whether another page of older entries is available to fetch. */
  canLoadMore?: boolean;
  /** Whether a load-more request is currently in flight. */
  isLoadingMore?: boolean;
  /** Fetches the next page of older entries. */
  onLoadMore?: () => void;
}

type ActivityLogEntry = Doc<"activityLogs">;
type AutomaticActivityLogEntry = ActivityLogEntry & {
  type: Exclude<ActivityLogEntry["type"], "note">;
};

const ACTIVITY_LOG_ICONS: Record<
  AutomaticActivityLogEntry["type"],
  LucideIcon
> = {
  status_change: RefreshCw,
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  decision: Scale,
  reference: Link2,
  waiting_change: Clock3,
  follow_up_change: Bell,
  area_move: MapPin,
};

// Rail geometry: the 1px line spans left 11–12px, so its center is 11.5px.
// Nodes use NODE_LEFT with -translate-x-1/2 to center exactly on the line.
const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ENTRY_PAD = "pl-9";

export function ActivityLog({
  logs,
  onAddNote,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: ActivityLogProps) {
  const [noteText, setNoteText] = useState("");
  const { run: addNote, isPending } = useGuardedAsyncAction(onAddNote, {
    errorToast: true,
  });

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text || isPending) return;

    const result = await addNote(text);
    if (result.ok) setNoteText("");
  };

  const handleAddNote = (event: FormEvent) => {
    event.preventDefault();
    void submitNote();
  };

  const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitNote();
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3.5">
      <div className="flex shrink-0 items-center gap-1">
        <h2 className="text-[11px] font-medium text-muted-foreground">
          Activity log
        </h2>
        {logs && logs.length > 0 && (
          <Badge
            variant="ghost"
            className="h-4 px-1.5 text-[10px] text-muted-foreground"
          >
            {logs.length}
          </Badge>
        )}
      </div>

      {/* Only this region scrolls; the pane's header and attention sections
          stay fixed above it. The rail's `relative` box must live inside the
          scroll container so the absolute rail spans the full entry list
          instead of being clipped to the visible height. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative pb-6">
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
            <form onSubmit={handleAddNote}>
              <FieldGroup className="gap-0">
                <Field data-disabled={isPending || undefined}>
                  <FieldLabel htmlFor="activity-log-note" className="sr-only">
                    Activity log note
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupTextarea
                      id="activity-log-note"
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      disabled={isPending}
                      aria-label="Activity log note"
                      placeholder="Add a note about what happened…"
                      className="min-h-10 pr-10 py-2 text-[13px]"
                      rows={1}
                      onKeyDown={handleNoteKeyDown}
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

          <ActivityLogTimeline
            logs={logs}
            canLoadMore={canLoadMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
        </div>
      </div>
    </section>
  );
}

function ActivityLogTimeline({
  logs,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: {
  logs: ActivityLogEntry[] | undefined;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  if (logs === undefined) return <ActivityLogSkeleton />;

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
    <div className="flex flex-col gap-4">
      {groupLogsByDay(logs).map((group) => (
        <section
          key={group.key}
          aria-label={group.label}
          className="flex flex-col"
        >
          <DayMarker label={group.label} />
          {group.logs.map((log) =>
            isAutomaticActivityLogEntry(log) ? (
              <AutomaticChange key={log._id} log={log} />
            ) : (
              <ManualNote key={log._id} log={log} />
            ),
          )}
        </section>
      ))}
      {(canLoadMore || isLoadingMore) && (
        <div className={cn("flex justify-center pt-1", ENTRY_PAD)}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isLoadingMore}
            aria-busy={isLoadingMore || undefined}
            onClick={onLoadMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2
                  data-icon="inline-start"
                  className="size-3.5 animate-spin"
                />
                Loading…
              </>
            ) : (
              "Show earlier"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Day label to the right of the rail, directly above its log items; the
 *  rail runs through uninterrupted. Group separation comes from the parent
 *  column's gap, not from padding here. */
function DayMarker({ label }: { label: string }) {
  return (
    <div className={cn("pb-1.5", ENTRY_PAD)}>
      <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
        {label}
      </h3>
    </div>
  );
}

/** A note: gold filled node + raised card body. */
function ManualNote({ log }: { log: ActivityLogEntry }) {
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
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-medium tracking-wide text-(--brand-gold) uppercase">
            Note
          </span>
          <ActivityLogTimestamp createdAt={log.createdAt} />
        </div>
        <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">
          {log.content}
        </p>
      </div>
    </div>
  );
}

/** An automatic change: tiny hollow node, single compact muted line. */
function AutomaticChange({ log }: { log: AutomaticActivityLogEntry }) {
  const Icon = ACTIVITY_LOG_ICONS[log.type];

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
        <Icon className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="shrink-0 font-medium">
          {getActivityLogEntryLabel(log.type)}
        </span>
        <span className="truncate text-muted-foreground/80">
          {getAutomaticChangeSummary(log)}
        </span>
        <span className="ml-auto shrink-0 pl-2">
          <ActivityLogTimestamp createdAt={log.createdAt} />
        </span>
      </div>
    </div>
  );
}

function ActivityLogTimestamp({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="shrink-0 text-[10px] text-muted-foreground/60"
    >
      {format(date, "h:mm a")}
    </time>
  );
}

function ActivityLogSkeleton() {
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

function groupLogsByDay(logs: ActivityLogEntry[]) {
  const groups = new Map<string, ActivityLogEntry[]>();

  for (const log of [...logs].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = format(new Date(log.createdAt), "yyyy-MM-dd");
    const group = groups.get(key) ?? [];
    group.push(log);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, groupLogs]) => ({
    key,
    label: getDayLabel(groupLogs[0]!.createdAt),
    logs: groupLogs,
  }));
}

function getDayLabel(createdAt: number) {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function getAutomaticChangeSummary(log: AutomaticActivityLogEntry) {
  if (log.previousValue && log.newValue) {
    return `${log.previousValue} → ${log.newValue}`;
  }

  if (log.newValue) return `Set to ${log.newValue}`;

  if (log.previousValue) {
    return log.type === "next_action_change" &&
      log.content.startsWith("Completed")
      ? `Completed ${log.previousValue}`
      : `Cleared ${log.previousValue}`;
  }

  return log.content;
}

function isAutomaticActivityLogEntry(
  log: ActivityLogEntry,
): log is AutomaticActivityLogEntry {
  return log.type !== "note";
}
