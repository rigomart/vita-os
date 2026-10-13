import type { ActivityLogEntry } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { format, isSameDay, isSameYear, subDays } from "date-fns";
import { Loader2 } from "lucide-react";

import { clock } from "../../lib/clock";
import {
  type ActivityLogEntryReading,
  readActivityLogEntry,
} from "../activity-log-entry";

interface ActivityLogProps {
  logs: ActivityLogEntry[] | undefined;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * The Thread's continuity record, written entirely by the system: one rail
 * behind every day, each entry a full sentence on it with its kind's icon as
 * the node. Nothing is cut off: long Task text wraps, and a resolution shows
 * its note and the Tasks it dropped.
 */
export function ActivityLog({
  logs,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: ActivityLogProps) {
  if (logs === undefined) return <ActivityLogSkeleton />;

  if (logs.length === 0) {
    return (
      <section aria-label="Activity log">
        <p className="text-sm text-muted-foreground">
          Automatic Thread changes will appear here as they happen.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Activity log" className="flex flex-col gap-4 pb-6">
      <div className="relative flex flex-col gap-4">
        {/* Drawn once behind every day, so it runs unbroken past their headings. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-[11.5px] w-px bg-border [mask-image:linear-gradient(to_bottom,transparent,black_1.5rem,black_calc(100%_-_1.5rem),transparent)]"
        />
        {groupLogsByDay(logs).map((group) => (
          <section
            key={group.key}
            aria-label={group.label}
            className="flex flex-col"
          >
            <h3 className="py-1 pl-9 text-xs font-medium text-muted-foreground">
              {group.label}
            </h3>
            <ol>
              {group.logs.map((log) => (
                <ActivityLogItem key={log._id} log={log} />
              ))}
            </ol>
          </section>
        ))}
      </div>
      {(canLoadMore || isLoadingMore) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-center"
          disabled={isLoadingMore}
          aria-busy={isLoadingMore || undefined}
          onClick={onLoadMore}
        >
          {isLoadingMore ? (
            <>
              <Loader2 data-icon="inline-start" className="animate-spin" />
              Loading…
            </>
          ) : (
            "Show earlier"
          )}
        </Button>
      )}
    </section>
  );
}

function ActivityLogItem({ log }: { log: ActivityLogEntry }) {
  const reading = readActivityLogEntry(log);
  const Icon = reading.icon;

  return (
    <li className="relative flex gap-3 py-2">
      <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-popover text-muted-foreground">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <div className="flex items-baseline gap-3">
          <p className="min-w-0 flex-1 text-sm leading-snug wrap-anywhere">
            <span className="sr-only">{reading.label}: </span>
            <Sentence reading={reading} />
          </p>
          <ActivityLogTimestamp createdAt={log.createdAt} />
        </div>
        <Carried reading={reading} />
      </div>
    </li>
  );
}

/** The action quiet, what it happened to in full, what it replaced after. */
function Sentence({ reading }: { reading: ActivityLogEntryReading }) {
  return (
    <>
      <span className="text-muted-foreground">{reading.action}</span>
      {reading.subject !== undefined && (
        <>
          {" "}
          <span className="text-foreground">{reading.subject}</span>
        </>
      )}
      {reading.from !== undefined && (
        <span className="text-muted-foreground">, from {reading.from}</span>
      )}
    </>
  );
}

/** What a resolution carried: its note, and the Tasks it dropped. */
function Carried({ reading }: { reading: ActivityLogEntryReading }) {
  if (reading.note === undefined && reading.dropped.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {reading.note !== undefined && (
        <p className="border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-line wrap-anywhere text-foreground">
          {reading.note}
        </p>
      )}
      {reading.dropped.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Dropped{" "}
            {reading.dropped.length === 1
              ? "an open Task"
              : `${reading.dropped.length} open Tasks`}
          </p>
          <ul className="flex flex-col gap-1">
            {reading.dropped.map((task, index) => (
              <li
                key={index}
                className="flex gap-2 text-sm leading-snug wrap-anywhere text-muted-foreground"
              >
                <span aria-hidden>–</span>
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ActivityLogTimestamp({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
    >
      {format(date, "h:mm a")}
    </time>
  );
}

function ActivityLogSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading activity log">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className={index % 2 === 0 ? "h-10 w-full" : "h-4 w-2/3"} />
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
  const today = clock.now();
  if (isSameDay(createdAt, today)) return "Today";
  if (isSameDay(createdAt, subDays(today, 1))) return "Yesterday";
  return format(
    createdAt,
    isSameYear(createdAt, today) ? "EEEE, MMMM d" : "MMMM d, yyyy",
  );
}
