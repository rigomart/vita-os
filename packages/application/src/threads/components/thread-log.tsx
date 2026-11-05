import type { ActivityLogEntry, ThreadNote } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Button } from "@vita-os/ui/components/button";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { Loader2 } from "lucide-react";
import { Fragment } from "react";

import { useAttentionClock } from "../../hooks/use-attention-clock";
import { lineKey, readActivityLog } from "../activity-log-entry";
import {
  daysBetween,
  headingLabel,
  QUIET_DAYS,
  spanWords,
} from "../activity-log-time";
import { ActivityLogLineItem } from "./thread-log-line";

interface ActivityLogProps {
  logs: ActivityLogEntry[] | undefined;
  /**
   * When the Thread was created, once the oldest page is loaded: the log then
   * ends with Started.
   */
  startedAt?: number;
  /** Whether the Thread is Resolved: then no quiet is told above the newest line. */
  resolved?: boolean;
  /** The Thread's Notes as they read now, for the entries that name one. */
  threadNotes?: ThreadNote[];
  /** Opens a Note an entry names in the Note view. */
  onOpenNote?: (note: ThreadNote) => void;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * The Thread's story, written by the system, newest first under day headings.
 * Three weeks or more without a line read as quiet, between days and, on an
 * Open Thread, above the newest.
 */
export function ActivityLog({
  logs,
  startedAt,
  resolved = false,
  threadNotes,
  onOpenNote,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: ActivityLogProps) {
  const today = useAttentionClock();
  if (logs === undefined) return <ActivityLogSkeleton />;

  const groups = readActivityLog(logs, startedAt);
  if (groups.length === 0) {
    return (
      <section aria-label="Activity log">
        <p className="text-sm text-muted-foreground">
          Automatic Thread changes will appear here as they happen.
        </p>
      </section>
    );
  }
  const sinceNewest = daysBetween(today, groups[0]!.to);

  return (
    <section aria-label="Activity log" className="flex flex-col gap-4 pb-6">
      <div className="relative flex flex-col gap-4">
        {/* Drawn once behind every day, so it runs unbroken past their headings. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-[11.5px] w-px bg-border [mask-image:linear-gradient(to_bottom,transparent,black_1.5rem,black_calc(100%_-_1.5rem),transparent)]"
        />
        {!resolved && sinceNewest >= QUIET_DAYS && (
          <Quiet>Quiet for {spanWords(sinceNewest)}</Quiet>
        )}
        {groups.map((group, index) => {
          const newer = groups[index - 1];
          const gap =
            newer === undefined ? 0 : daysBetween(newer.from, group.to);
          const label = headingLabel(group.from, group.to, today);
          return (
            <Fragment key={group.key}>
              {gap >= QUIET_DAYS && <Quiet>{spanWords(gap)} quiet</Quiet>}
              <section aria-label={label} className="flex flex-col">
                <h3 className="py-1 pl-9 text-xs font-medium text-muted-foreground">
                  {label}
                </h3>
                <ol>
                  {group.lines.map((line) => (
                    <ActivityLogLineItem
                      key={lineKey(line)}
                      line={line}
                      startedAt={startedAt}
                      threadNotes={threadNotes}
                      onOpenNote={onOpenNote}
                      today={today}
                    />
                  ))}
                </ol>
              </section>
            </Fragment>
          );
        })}
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

function Quiet({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex items-center py-3 pl-9">
      <span aria-hidden className="absolute inset-y-0 left-2 w-2 bg-popover" />
      <span
        aria-hidden
        className="absolute inset-y-1 left-[11.5px] border-l border-dashed border-muted-foreground/35"
      />
      <p className="text-xs text-muted-foreground italic">{children}</p>
    </div>
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
