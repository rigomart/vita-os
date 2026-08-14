// PROTOTYPE — throwaway.
// Variant "Double-decker": the command bar split into two slim decks inside one
// strip — a very quiet meta line (date, condition counters, verdict) over an
// actionable line of attention Area chips that collapses away on good days.
import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { format } from "date-fns";

import type {
  DashboardArea,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import type { DashboardHeroProps } from "@/features/dashboard/prototype/hero-contract";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import {
  followUpDateLabel,
  startOfLocalDay,
} from "@/features/dashboard/components/dashboard-model";
import { cn } from "@/lib/utils";

/** Counter segments read worst-first, so the eye lands on trouble. */
const segmentOrder: Condition[] = ["critical", "needs_attention", "healthy"];

const segmentLabels: Record<Condition, string> = {
  critical: "needs you",
  needs_attention: "watch",
  healthy: "steady",
};

/** Chips carry a hint, so fewer fit than bare names before deck 2 wraps twice. */
const CHIP_CAP = 3;

interface ChipHint {
  /** Soonest follow-up on the Area's Threads, when one exists. */
  due?: { label: string; overdue: boolean };
  text?: string;
}

export function HeroVariantDoubleDecker({
  areas,
  threads,
  currentDate,
}: DashboardHeroProps) {
  const date = new Date(currentDate);
  const counts = countByCondition(areas);
  const segments = segmentOrder.filter((condition) => counts[condition] > 0);

  const attention = areas
    .filter((area) => area.condition !== "healthy")
    .sort(worstFirst);
  const chipped = attention.slice(0, CHIP_CAP);
  const hidden = attention.slice(CHIP_CAP);
  const steady = areas.filter((area) => area.condition === "healthy");

  const threadsByArea = new Map<string, DashboardThread[]>();
  for (const thread of threads) {
    const bucket = threadsByArea.get(thread.areaId);
    if (bucket) bucket.push(thread);
    else threadsByArea.set(thread.areaId, [thread]);
  }

  return (
    <section
      aria-label="Life Areas by condition"
      className="flex flex-col gap-1.5 border-b border-border/60 pb-2"
    >
      {/* Deck 1 — meta. Nothing here is clickable; it just sets the scene. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
        <time
          dateTime={date.toISOString()}
          title={format(date, "EEEE, MMMM d, yyyy")}
          className="shrink-0"
        >
          <span className="font-semibold uppercase tracking-wider text-foreground">
            {format(date, "EEE")}
          </span>{" "}
          {format(date, "MMM d")}
        </time>

        {segments.length > 0 && (
          <div className="inline-flex shrink-0 items-center divide-x divide-border/60">
            {segments.map((condition) => {
              const StateIcon = conditionIcons[condition];
              return (
                <span
                  key={condition}
                  title={`${counts[condition]} ${segmentLabels[condition]}`}
                  className="inline-flex items-center gap-1 px-1.5 first:pl-0 last:pr-0"
                >
                  <StateIcon
                    aria-hidden
                    className={cn("size-3", conditionTextClassName[condition])}
                  />
                  <span className="font-semibold leading-none tabular-nums text-foreground">
                    {counts[condition]}
                  </span>
                  <span className="sr-only">{segmentLabels[condition]}</span>
                </span>
              );
            })}
          </div>
        )}

        <span className="min-w-0 truncate">{verdict(areas, attention)}</span>
      </div>

      {/* Deck 2 — actionable. Absent entirely when nothing is flagged. */}
      {chipped.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {chipped.map((area) => (
            <AreaChip
              key={area.id}
              area={area}
              hint={chipHint(threadsByArea.get(area.id) ?? [], currentDate)}
            />
          ))}

          {hidden.length > 0 && (
            <span
              title={hidden.map((area) => area.name).join(", ")}
              className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground"
            >
              +{hidden.length} more
            </span>
          )}

          {steady.length > 0 && <SteadyTally areas={steady} />}
        </div>
      )}
    </section>
  );
}

/** One attention Area: identity, name, and the reason it is on this deck. */
function AreaChip({ area, hint }: { area: DashboardArea; hint?: ChipHint }) {
  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug }}
      title={[area.name, hint?.due?.label, hint?.text]
        .filter(Boolean)
        .join(" · ")}
      className="group inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-1.5 transition-colors hover:bg-muted/70"
    >
      <AreaIcon
        icon={area.icon}
        className={cn(
          "size-3.5 shrink-0",
          conditionTextClassName[area.condition],
        )}
      />
      <span className="max-w-32 truncate text-xs font-medium underline-offset-4 group-hover:underline">
        {area.name}
      </span>

      {hint && (
        <>
          <span aria-hidden className="h-3 w-px shrink-0 bg-border" />
          {hint.due && (
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                hint.due.overdue
                  ? cn("font-semibold", conditionTextClassName.critical)
                  : "text-muted-foreground",
              )}
            >
              {hint.due.overdue ? "Late · " : ""}
              {hint.due.label}
            </span>
          )}
          {/* The free text is the first thing to go when the strip gets tight. */}
          {hint.text && (
            <span className="hidden max-w-40 truncate text-[11px] text-muted-foreground sm:inline">
              {hint.text}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

/** Every healthy Area, name-free, parked at the end of the actionable deck. */
function SteadyTally({ areas }: { areas: DashboardArea[] }) {
  const SteadyIcon = conditionIcons.healthy;

  return (
    <span
      title={areas.map((area) => area.name).join(", ")}
      className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 px-1 text-[11px] text-muted-foreground"
    >
      <SteadyIcon
        aria-hidden
        className={cn("size-3.5", conditionTextClassName.healthy)}
      />
      <span className="tabular-nums">{areas.length}</span> steady
    </span>
  );
}

/**
 * The chip's "why": the soonest follow-up wins (it is the thing with a clock on
 * it), then any captured next move. Areas with neither wear no hint at all.
 */
function chipHint(
  threads: DashboardThread[],
  currentDate: number,
): ChipHint | undefined {
  const soonest = threads
    .filter(
      (thread): thread is DashboardThread & { followUp: number } =>
        thread.followUp !== undefined,
    )
    .sort((a, b) => a.followUp - b.followUp)[0];

  if (soonest) {
    return {
      due: {
        label: followUpDateLabel(soonest.followUp, currentDate),
        overdue:
          startOfLocalDay(soonest.followUp) < startOfLocalDay(currentDate),
      },
      text: soonest.nextMove ?? soonest.title,
    };
  }

  const moved = [...threads]
    .sort((a, b) => a.order - b.order)
    .find((thread) => thread.nextMove);
  if (moved?.nextMove) return { text: moved.nextMove };

  return undefined;
}

/** Terse read on the day, in place of a page title. */
function verdict(areas: DashboardArea[], attention: DashboardArea[]) {
  if (areas.length === 0) return "No Life Areas yet";
  if (attention.length === 0) return "All steady";

  const critical = attention.filter(
    (area) => area.condition === "critical",
  ).length;
  if (critical > 0) return `${critical} need${critical === 1 ? "s" : ""} you`;
  return `${attention.length} to watch`;
}

function countByCondition(areas: DashboardArea[]): Record<Condition, number> {
  const counts: Record<Condition, number> = {
    critical: 0,
    needs_attention: 0,
    healthy: 0,
  };
  for (const area of areas) counts[area.condition] += 1;
  return counts;
}

function worstFirst(a: DashboardArea, b: DashboardArea) {
  const rank = (area: DashboardArea) => (area.condition === "critical" ? 0 : 1);
  return rank(a) - rank(b) || a.order - b.order;
}
