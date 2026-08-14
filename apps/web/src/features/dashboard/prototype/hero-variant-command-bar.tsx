// PROTOTYPE — throwaway.
// Variant idea: the whole hero collapsed into one instrument-cluster strip —
// date lead-in, segmented condition counters, attention Area names inline.
import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { format } from "date-fns";

import type { DashboardArea } from "@/features/dashboard/components/dashboard-model";
import type { DashboardHeroProps } from "@/features/dashboard/prototype/hero-contract";

import {
  conditionDotClassName,
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

/** Counter segments read worst-first, so the eye lands on trouble. */
const segmentOrder: Condition[] = ["critical", "needs_attention", "healthy"];

const segmentLabels: Record<Condition, string> = {
  critical: "needs you",
  needs_attention: "watch",
  healthy: "steady",
};

/** Past this many names the bar spends more height than it earns. */
const NAME_CAP = 3;

export function HeroVariantCommandBar({
  areas,
  currentDate,
}: DashboardHeroProps) {
  const date = new Date(currentDate);
  const counts = countByCondition(areas);
  const segments = segmentOrder.filter((condition) => counts[condition] > 0);

  const attention = areas
    .filter((area) => area.condition !== "healthy")
    .sort(worstFirst);
  const named = attention.slice(0, NAME_CAP);
  const hidden = attention.slice(NAME_CAP);

  return (
    <section
      aria-label="Life Areas by condition"
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border/60 pb-2"
    >
      <time
        dateTime={date.toISOString()}
        title={format(date, "EEEE, MMMM d, yyyy")}
        className="shrink-0 text-xs text-muted-foreground"
      >
        <span className="font-semibold uppercase tracking-wider text-foreground">
          {format(date, "EEE")}
        </span>{" "}
        {format(date, "MMM d")}
      </time>

      {segments.length > 0 && (
        <div className="inline-flex h-6 shrink-0 items-center divide-x divide-border/60 overflow-hidden rounded-md border border-border/60 bg-muted/30">
          {segments.map((condition) => {
            const StateIcon = conditionIcons[condition];
            return (
              <span
                key={condition}
                title={`${counts[condition]} ${segmentLabels[condition]}`}
                className="inline-flex h-full items-center gap-1 px-1.5"
              >
                <StateIcon
                  aria-hidden
                  className={cn("size-3", conditionTextClassName[condition])}
                />
                <span className="text-[11px] font-semibold leading-none tabular-nums">
                  {counts[condition]}
                </span>
                <span className="sr-only">{segmentLabels[condition]}</span>
              </span>
            );
          })}
        </div>
      )}

      {named.length > 0 ? (
        <>
          <span aria-hidden className="hidden h-3.5 w-px bg-border sm:block" />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {named.map((area) => (
              <Link
                key={area.id}
                to="/$areaSlug"
                params={{ areaSlug: area.slug }}
                title={area.name}
                className="group inline-flex h-6 min-w-0 items-center gap-1.5 rounded-sm px-0.5 text-xs transition-colors hover:bg-muted/60"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    conditionDotClassName[area.condition],
                  )}
                />
                <span className="max-w-36 truncate font-medium underline-offset-4 group-hover:underline">
                  {area.name}
                </span>
              </Link>
            ))}
            {hidden.length > 0 && (
              <span
                title={hidden.map((area) => area.name).join(", ")}
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
              >
                +{hidden.length} more
              </span>
            )}
          </div>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          {areas.length === 0 ? "No Life Areas yet" : "All areas steady"}
        </span>
      )}
    </section>
  );
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
