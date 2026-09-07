import type { ProjectedActivityLog } from "@convex/lib/validators";
import type { LucideIcon } from "lucide-react";

import { Button } from "@vita-os/ui/components/button";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ArrowRight, Bell, CircleCheck, Loader2, MapPin } from "lucide-react";

import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";
import { cn } from "@/lib/utils";

interface ActivityLogProps {
  logs: ProjectedActivityLog[] | undefined;
  /** Drives the timeline's origin caption — when this Thread last moved. */
  lastActivityAt?: number;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

type ActivityLogEntry = ProjectedActivityLog;
type AutomaticActivityLogEntry = ActivityLogEntry & {
  type: Exclude<ActivityLogEntry["type"], "note">;
};

const ACTIVITY_LOG_ICONS: Record<
  AutomaticActivityLogEntry["type"],
  LucideIcon
> = {
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  follow_up_change: Bell,
  area_move: MapPin,
};

// Rail geometry: the 1px line spans left 11–12px, so its center is 11.5px.
// Nodes use NODE_LEFT with -translate-x-1/2 to center exactly on the line.
const RAIL_LEFT = "left-[11px]";
const NODE_LEFT = "left-[11.5px]";
const ENTRY_PAD = "pl-9";

/**
 * The Thread's continuity record, written entirely by the system: a rail from
 * "now" back through every automatic entry.
 */
export function ActivityLog({
  logs,
  lastActivityAt,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: ActivityLogProps) {
  const automaticLogs = logs?.filter(isAutomaticActivityLogEntry);

  return (
    <section aria-label="Activity log" className="flex flex-col gap-2">
      <div className="relative pb-6">
        <div
          aria-hidden
          className={cn(
            "absolute top-1 bottom-0 w-px",
            RAIL_LEFT,
            "bg-gradient-to-b from-transparent via-border to-transparent",
          )}
        />

        <TimelineOrigin lastActivityAt={lastActivityAt} />

        <ActivityLogTimeline
          logs={automaticLogs}
          canLoadMore={canLoadMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />
      </div>
    </section>
  );
}

/**
 * The rail's origin is "now": the node the newest entry hangs from, captioned
 * with how long this Thread has been standing still.
 */
function TimelineOrigin({ lastActivityAt }: { lastActivityAt?: number }) {
  return (
    <div className={cn("relative pb-4", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-2.5 -translate-x-1/2 rounded-full",
          NODE_LEFT,
          "border border-(--brand-gold) bg-background",
        )}
      >
        <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
      </span>
      <p className="text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
        {lastActivityAt === undefined
          ? "No activity yet"
          : `Updated ${formatDistanceToNow(new Date(lastActivityAt), {
              addSuffix: true,
            })}`}
      </p>
    </div>
  );
}

function ActivityLogTimeline({
  logs,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: {
  logs: AutomaticActivityLogEntry[] | undefined;
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
        <p className="text-sm leading-snug text-muted-foreground">
          Automatic Thread changes will appear here as they happen.
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
          {group.logs.map((log) => (
            <AutomaticChange key={log._id} log={log} />
          ))}
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
      <h3 className="text-2xs font-medium tracking-wide text-muted-foreground/80 uppercase">
        {label}
      </h3>
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
        <span className="sr-only">{getActivityLogEntryLabel(log.type)}</span>
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
      className="shrink-0 text-2xs text-muted-foreground/60"
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

function groupLogsByDay(logs: AutomaticActivityLogEntry[]) {
  const groups = new Map<string, AutomaticActivityLogEntry[]>();

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
