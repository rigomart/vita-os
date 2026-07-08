import type { Doc } from "@convex/_generated/dataModel";

import { conditionColors, conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  compareAreaThreadGroupsByPriority,
  compareThreadsByStatusUrgency,
  getThreadStatus,
  partitionThreadsByAttention,
  type ThreadStatusInput,
  type ThreadStatus,
} from "@/features/threads/derived-status";
import {
  flatListClassName,
  flatListRowHoverClassName,
} from "@/lib/flat-surface";

export interface DashboardThread extends ThreadStatusInput {
  area?: Doc<"areas">;
  areaId: string;
  areaSlug: string;
  id: string;
  key: string;
  threadName: string;
  threadSlug: string;
}

export interface DashboardAreaSummary {
  area: Doc<"areas">;
  threadCount: number;
  attentionCount: number;
}

interface DashboardThreadGroupsProps {
  areas: DashboardAreaSummary[];
  threads: DashboardThread[];
  currentDate: number;
}

interface AreaThreadGroup {
  area: Doc<"areas">;
  areaSlug: string;
  attentionThreads: DashboardThread[];
  quietThreads: DashboardThread[];
  threads: DashboardThread[];
}

export function DashboardThreadGroups({
  areas,
  threads,
  currentDate,
}: DashboardThreadGroupsProps) {
  const [showQuietThreads, setShowQuietThreads] = useState(false);
  const groupedAreas = useMemo(
    () => buildAreaThreadGroups({ areas, threads, currentDate }),
    [areas, threads, currentDate],
  );

  const attentionCount = groupedAreas.reduce(
    (count, group) => count + group.attentionThreads.length,
    0,
  );
  const quietCount = groupedAreas.reduce(
    (count, group) => count + group.quietThreads.length,
    0,
  );
  const visibleGroups = groupedAreas
    .map((group) => ({
      ...group,
      visibleThreads: showQuietThreads
        ? [...group.attentionThreads, ...group.quietThreads].sort((a, b) =>
            compareThreadsByStatusUrgency(a, b, currentDate),
          )
        : group.attentionThreads,
    }))
    .filter((group) => group.visibleThreads.length > 0);

  return (
    <section className="flex flex-col gap-10">
      {attentionCount === 0 && <AllClearState />}

      {visibleGroups.map((group) => (
        <AreaThreadSection
          key={group.area._id}
          group={group}
          threads={group.visibleThreads}
          currentDate={currentDate}
        />
      ))}

      {quietCount > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowQuietThreads((value) => !value)}
            className="gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
          >
            {showQuietThreads ? (
              <>
                Hide quiet threads
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show {quietCount} quiet{" "}
                {quietCount === 1 ? "thread" : "threads"}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}

function AllClearState() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-condition-healthy/10 text-condition-healthy">
        <Check className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-sm font-medium">
          Nothing needs your attention right now
        </p>
        <p className="text-xs text-muted-foreground">
          Quiet Threads are still here when you want to review them.
        </p>
      </div>
    </div>
  );
}

function buildAreaThreadGroups({
  areas,
  threads,
  currentDate,
}: DashboardThreadGroupsProps): AreaThreadGroup[] {
  const areaById = new Map(areas.map(({ area }) => [area._id as string, area]));
  const groupsByAreaId = new Map<string, DashboardThread[]>();

  for (const thread of threads) {
    const area = thread.area ?? areaById.get(thread.areaId);
    if (!area) continue;

    const areaId = area._id as string;
    const groupThreads = groupsByAreaId.get(areaId) ?? [];
    groupThreads.push({ ...thread, area, areaId });
    groupsByAreaId.set(areaId, groupThreads);
  }

  return [...groupsByAreaId.entries()]
    .map(([areaId, groupThreads]) => {
      const area = areaById.get(areaId) ?? groupThreads[0]?.area;
      if (!area) return null;

      const sortedThreads = [...groupThreads].sort((a, b) =>
        compareThreadsByStatusUrgency(a, b, currentDate),
      );
      const { attention, quiet } = partitionThreadsByAttention(
        sortedThreads,
        currentDate,
      );

      return {
        area,
        areaSlug: area.slug ?? area._id,
        attentionThreads: attention,
        quietThreads: quiet,
        threads: sortedThreads,
      };
    })
    .filter((group): group is AreaThreadGroup => group !== null)
    .sort((a, b) => compareAreaThreadGroupsByPriority(a, b, currentDate));
}

function AreaThreadSection({
  group,
  threads,
  currentDate,
}: {
  group: AreaThreadGroup;
  threads: DashboardThread[];
  currentDate: number;
}) {
  const conditionLabel = conditionLabels[group.area.condition];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/$areaSlug"
          params={{ areaSlug: group.areaSlug }}
          className="min-w-0 text-sm font-medium transition-colors hover:text-foreground/80"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                conditionColors[group.area.condition],
              )}
              aria-label={conditionLabel}
            />
            <span className="truncate">{group.area.name}</span>
            {group.area.condition !== "healthy" && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {conditionLabel}
              </span>
            )}
          </span>
        </Link>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
          {threads.length}
        </span>
      </div>

      <div className={flatListClassName}>
        {threads.map((thread) => (
          <DashboardThreadRow
            key={thread.key}
            thread={thread}
            currentDate={currentDate}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardThreadRow({
  thread,
  currentDate,
}: {
  thread: DashboardThread;
  currentDate: number;
}) {
  const status = getThreadStatus(thread, currentDate);

  return (
    <Link
      to="/$areaSlug/$threadSlug"
      params={{ areaSlug: thread.areaSlug, threadSlug: thread.threadSlug }}
      className={cn(
        "flex items-start justify-between gap-3 py-3.5",
        flatListRowHoverClassName,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{thread.threadName}</p>
        <ThreadSubtitle thread={thread} />
      </div>
      <ThreadStatusBadge status={status} />
    </Link>
  );
}

function ThreadSubtitle({ thread }: { thread: DashboardThread }) {
  const followUp =
    thread.followUp != null ? new Date(thread.followUp) : undefined;

  if (!thread.nextMove && !followUp) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {thread.nextMove && (
        <span className="flex min-w-0 items-center gap-1.5">
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="truncate">{thread.nextMove}</span>
        </span>
      )}
      {followUp && (
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span>
            {format(followUp, "MMM d")} ·{" "}
            {formatDistanceToNow(followUp, { addSuffix: true })}
          </span>
        </span>
      )}
    </div>
  );
}

function ThreadStatusBadge({ status }: { status: ThreadStatus }) {
  // Only a due Follow-up earns a badge. "Ready" and "Scheduled" are already
  // communicated by the subtitle (next move / follow-up date), and a plain
  // "Open" Thread is a calm, valid state that needs no label.
  if (status !== "follow_up_due") return null;

  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400"
    >
      <CalendarClock className="h-3 w-3" />
      Follow-up due
    </Badge>
  );
}
