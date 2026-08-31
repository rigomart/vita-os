import { groupThreadsByAttention } from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleDashed } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "./dashboard-model";

import { dayDelta, daysSince, relativeDayLabel } from "./dashboard-model";

interface DashboardAttentionProps {
  areas: DashboardArea[];
  currentDate: number;
  tasks: DashboardInboxTask[];
  threads: DashboardThread[];
}

interface DashboardAttentionEntry {
  area?: DashboardArea;
  thread: DashboardThread;
}

const INBOX_PREVIEW_LIMIT = 3;
const QUIET_AFTER_DAYS = 7;

/**
 * The Dashboard's canonical awareness surface.
 *
 * Thread position belongs exclusively to the attention engine. Follow-up is
 * rendered as an annotation rather than a coordinate, and plain Open Threads
 * remain first-class rows at the end of the same run.
 */
export function DashboardAttention({
  areas,
  currentDate,
  tasks,
  threads,
}: DashboardAttentionProps) {
  const run = buildAttentionRun(threads, areas, currentDate);

  return (
    <div className="flex flex-col gap-5">
      {run.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No open Threads right now.
        </p>
      ) : (
        <ol aria-label="Threads in attention order" className="flex flex-col">
          {run.map(({ area, thread }) => (
            <DashboardThreadRow
              key={thread.id}
              area={area}
              currentDate={currentDate}
              thread={thread}
            />
          ))}
        </ol>
      )}

      <InboxSynopsis currentDate={currentDate} tasks={tasks} />
    </div>
  );
}

function buildAttentionRun(
  threads: DashboardThread[],
  areas: DashboardArea[],
  currentDate: number,
): DashboardAttentionEntry[] {
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const groups = groupThreadsByAttention(threads, currentDate);

  return [
    ...groups.overdue,
    ...groups.upcoming,
    ...groups.withNextMoves,
    ...groups.open,
  ].map((thread) => ({ area: areaById.get(thread.areaId), thread }));
}

function DashboardThreadRow({
  area,
  currentDate,
  thread,
}: {
  area?: DashboardArea;
  currentDate: number;
  thread: DashboardThread;
}) {
  const nextMove = thread.nextMove?.trim();
  const detail = nextMove || thread.summary?.trim();
  const quietDays =
    thread.lastActivityAt === undefined
      ? undefined
      : daysSince(thread.lastActivityAt, currentDate);

  return (
    <li>
      <Link
        to="."
        search={(previous) => ({ ...previous, thread: thread.slug })}
        className="flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <FollowUpAnnotation
          currentDate={currentDate}
          followUp={thread.followUp}
        />

        <span
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            detail ? "max-w-[48%] shrink-0" : "flex-1",
          )}
        >
          {thread.title}
        </span>

        {detail && (
          <span className="flex min-w-0 flex-1 items-baseline gap-1 text-xs text-muted-foreground/80">
            {nextMove && (
              <ArrowRight
                aria-hidden
                className="size-3 shrink-0 translate-y-0.5"
              />
            )}
            <span className="truncate">{detail}</span>
          </span>
        )}

        {quietDays !== undefined && quietDays >= QUIET_AFTER_DAYS && (
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
            quiet {quietDays}d
          </span>
        )}

        {area && <AreaMark area={area} />}
      </Link>
    </li>
  );
}

function FollowUpAnnotation({
  currentDate,
  followUp,
}: {
  currentDate: number;
  followUp?: number;
}) {
  if (followUp === undefined) {
    return (
      <span
        aria-label="No follow-up"
        className="w-16 shrink-0 text-right text-2xs text-muted-foreground/35"
      >
        —
      </span>
    );
  }

  const delta = dayDelta(followUp, currentDate);
  return (
    <time
      dateTime={new Date(followUp).toISOString()}
      className={cn(
        "w-16 shrink-0 truncate text-right text-2xs tabular-nums",
        delta < 0
          ? "font-semibold text-condition-attention"
          : delta <= 1
            ? "font-semibold text-foreground"
            : delta <= 6
              ? "text-foreground/70"
              : "text-muted-foreground/70",
      )}
    >
      {relativeDayLabel(followUp, currentDate)}
    </time>
  );
}

function AreaMark({ area }: { area: DashboardArea }) {
  return (
    <span
      title={`${area.name} — ${conditionLabels[area.condition]}`}
      className={cn(
        "hidden w-28 shrink-0 items-center justify-end gap-1 text-2xs sm:flex",
        conditionTextClassName[area.condition],
      )}
    >
      <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
      <span className="truncate">{area.name}</span>
    </span>
  );
}

function InboxSynopsis({
  currentDate,
  tasks,
}: {
  currentDate: number;
  tasks: DashboardInboxTask[];
}) {
  if (tasks.length === 0) return null;

  const dated = tasks
    .filter(
      (task): task is DashboardInboxTask & { when: number } =>
        task.when !== undefined,
    )
    .sort((a, b) => a.when - b.when);
  const shown = dated.slice(0, INBOX_PREVIEW_LIMIT);
  const remaining = tasks.length - shown.length;

  return (
    <section
      aria-label="Inbox synopsis"
      className="border-t border-border/50 pt-3 text-muted-foreground"
    >
      <Link
        to="."
        search={(previous) => ({ ...previous, inbox: true })}
        className="inline-flex items-center gap-1.5 rounded-sm text-2xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <CircleDashed aria-hidden className="size-3.5" />
        <span className="font-medium">Inbox</span>
        <span className="tabular-nums">· {tasks.length} open</span>
      </Link>

      {shown.length > 0 && (
        <ul className="mt-1 flex flex-col">
          {shown.map((task) => (
            <li key={task.id} className="flex h-7 items-center gap-2.5 px-2">
              <time
                dateTime={new Date(task.when).toISOString()}
                className={cn(
                  "w-16 shrink-0 text-right text-2xs tabular-nums",
                  dayDelta(task.when, currentDate) < 0
                    ? "font-medium text-condition-attention"
                    : "text-muted-foreground/70",
                )}
              >
                {relativeDayLabel(task.when, currentDate)}
              </time>
              <span className="min-w-0 truncate text-2xs">{task.text}</span>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <p className="mt-1 px-2 text-2xs tabular-nums text-muted-foreground/60">
          +{remaining} more
        </p>
      )}
    </section>
  );
}
