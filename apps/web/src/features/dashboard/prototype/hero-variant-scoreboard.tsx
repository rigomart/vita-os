// PROTOTYPE — throwaway.
// Variant "Scoreboard": no page title and no date header — the Life Areas
// themselves are the header, as one tile row where attention is loud and
// steady is quiet, doubling as the primary navigation into each Area.
import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { format, formatDistance } from "date-fns";

import type { DashboardHeroProps } from "@/features/dashboard/prototype/hero-contract";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionDotClassName,
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import {
  followUpDateLabel,
  recentActivity,
  startOfLocalDay,
  type DashboardArea,
  type DashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import { cn } from "@/lib/utils";

const attentionLabels: Partial<Record<Condition, string>> = {
  critical: "Needs you",
  needs_attention: "Watch",
};

const conditionRank: Record<Condition, number> = {
  critical: 0,
  needs_attention: 1,
  healthy: 2,
};

function byConditionThenOrder(a: DashboardArea, b: DashboardArea) {
  return (
    conditionRank[a.condition] - conditionRank[b.condition] || a.order - b.order
  );
}

/** Threads grouped by Area, each group in the Area's own thread order. */
function groupByArea(threads: DashboardThread[]) {
  const byArea = new Map<string, DashboardThread[]>();
  for (const thread of [...threads].sort((a, b) => a.order - b.order)) {
    const group = byArea.get(thread.areaId);
    if (group) group.push(thread);
    else byArea.set(thread.areaId, [thread]);
  }
  return byArea;
}

/**
 * The one line a loud tile can afford: whatever is most overdue, else the
 * freshest activity, else the standing next move, else what is coming.
 */
function reasonLine(
  threads: DashboardThread[],
  currentDate: number,
): string | undefined {
  const today = startOfLocalDay(currentDate);
  const dated = threads
    .flatMap((thread) =>
      thread.followUp === undefined
        ? []
        : [{ thread, followUp: thread.followUp }],
    )
    .sort((a, b) => a.followUp - b.followUp);

  const due = dated.find((entry) => startOfLocalDay(entry.followUp) <= today);
  if (due) {
    return `${followUpDateLabel(due.followUp, currentDate)} · ${due.thread.title}`;
  }

  const [freshest] = recentActivity(threads, 1);
  if (freshest) {
    const when = formatDistance(
      new Date(freshest.lastActivityAt),
      new Date(currentDate),
      { addSuffix: true },
    );
    return `${freshest.lastActivityContent} · ${when}`;
  }

  const nextMove = threads.find((thread) => thread.nextMove)?.nextMove;
  if (nextMove) return `Next: ${nextMove}`;

  const [upcoming] = dated;
  if (upcoming) {
    return `${followUpDateLabel(upcoming.followUp, currentDate)} · ${upcoming.thread.title}`;
  }
  return undefined;
}

function threadCountLabel(count: number) {
  if (count === 0) return "No threads";
  return `${count} ${count === 1 ? "thread" : "threads"}`;
}

export function HeroVariantScoreboard({
  areas,
  threads,
  currentDate,
}: DashboardHeroProps) {
  const threadsByArea = groupByArea(threads);
  const ranked = [...areas].sort(byConditionThenOrder);
  const attentionCount = ranked.filter(
    (area) => area.condition !== "healthy",
  ).length;

  return (
    <section aria-label="Life Areas at a glance">
      {/* The page has no visible title by design; the tiles are the header. */}
      <h1 className="sr-only">Life Areas</h1>

      {/* One row: horizontally scrollable on a phone, wrapping from sm up.
          Tiles stretch to a shared height so the row reads as a scoreboard. */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-2 snap-x sm:flex-wrap sm:overflow-x-visible sm:pb-0">
        <StatusCell
          areaCount={areas.length}
          attentionCount={attentionCount}
          currentDate={currentDate}
        />

        {ranked.map((area) => {
          const areaThreads = threadsByArea.get(area.id) ?? [];
          return area.condition === "healthy" ? (
            <SteadyTile key={area.id} area={area} count={areaThreads.length} />
          ) : (
            <AttentionTile
              key={area.id}
              area={area}
              count={areaThreads.length}
              reason={reasonLine(areaThreads, currentDate)}
            />
          );
        })}
      </div>
    </section>
  );
}

/**
 * The row's only non-Area cell: the tally, with the date tucked under it as an
 * incidental stamp rather than a header of its own.
 */
function StatusCell({
  areaCount,
  attentionCount,
  currentDate,
}: {
  areaCount: number;
  attentionCount: number;
  currentDate: number;
}) {
  const date = new Date(currentDate);
  const headline =
    areaCount === 0
      ? "No Life Areas"
      : attentionCount === 0
        ? "All steady"
        : `${attentionCount} need${attentionCount === 1 ? "s" : ""} you`;

  return (
    <div className="flex shrink-0 snap-start flex-col justify-center pr-2 pl-0.5">
      <span
        className={cn(
          "text-sm font-semibold tracking-tight",
          attentionCount === 0 && areaCount > 0 && "text-muted-foreground",
        )}
      >
        {headline}
      </span>
      <time
        dateTime={date.toISOString()}
        title={format(date, "EEEE, MMMM d, yyyy")}
        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground tabular-nums"
      >
        {format(date, "EEE MMM d")}
        {areaCount > 0 && <span aria-hidden> · {areaCount} areas</span>}
      </time>
    </div>
  );
}

/** Loud tile: condition rail, condition-coloured verdict, one reason line. */
function AttentionTile({
  area,
  count,
  reason,
}: {
  area: DashboardArea;
  count: number;
  reason: string | undefined;
}) {
  const StateIcon = conditionIcons[area.condition];

  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug }}
      className="flex w-56 shrink-0 snap-start items-stretch gap-2.5 overflow-hidden rounded-xl border border-border bg-card/70 p-2.5 transition-colors hover:bg-muted/60"
    >
      <span
        aria-hidden
        className={cn(
          "w-1 shrink-0 self-stretch rounded-full",
          conditionDotClassName[area.condition],
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
          <span className="truncate text-sm font-semibold">{area.name}</span>
          <StateIcon
            aria-hidden
            className={cn(
              "ml-auto size-3.5 shrink-0",
              conditionTextClassName[area.condition],
            )}
          />
        </div>
        <p
          className={cn(
            "mt-1 truncate text-[11px] font-semibold",
            conditionTextClassName[area.condition],
          )}
        >
          {attentionLabels[area.condition]}
          <span className="font-normal text-muted-foreground">
            {" · "}
            {threadCountLabel(count)}
          </span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {reason ?? "Nothing logged yet"}
        </p>
      </div>
    </Link>
  );
}

/** Quiet tile: enough to name and reach the Area, nothing more. */
function SteadyTile({ area, count }: { area: DashboardArea; count: number }) {
  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug }}
      title={`${area.name} — steady, ${threadCountLabel(count).toLowerCase()}`}
      className="flex w-24 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border border-transparent bg-muted/40 px-2 py-2.5 text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
    >
      <span className="flex items-center gap-1">
        <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full opacity-70",
            conditionDotClassName[area.condition],
          )}
        />
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium">
        {area.name}
      </span>
    </Link>
  );
}
