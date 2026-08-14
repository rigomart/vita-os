// PROTOTYPE — throwaway.
// Variant "Roomy strip": the command bar at full size — still one titleless row
// (date lead-in, condition counters, attention Areas inline), but scaled up:
// legible text, generous gaps, and attention Areas as real tappable pills.
import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { format } from "date-fns";

import type { DashboardArea } from "@/features/dashboard/components/dashboard-model";
import type { DashboardHeroProps } from "@/features/dashboard/prototype/hero-contract";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionDotClassName,
  conditionIcons,
  conditionPillClassName,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

/** Counters carry the trouble only; steady is tallied at the far end. */
const counterOrder: Condition[] = ["critical", "needs_attention"];

const counterLabels: Record<Condition, string> = {
  critical: "need you",
  needs_attention: "to watch",
  healthy: "steady",
};

/** Full-size pills earn their room; past three the row buys a second line. */
const PILL_CAP = 3;

export function HeroVariantRoomyStrip({
  areas,
  currentDate,
}: DashboardHeroProps) {
  const date = new Date(currentDate);
  const counts = countByCondition(areas);
  const counters = counterOrder.filter((condition) => counts[condition] > 0);

  const attention = areas
    .filter((area) => area.condition !== "healthy")
    .sort(worstFirst);
  const pinned = attention.slice(0, PILL_CAP);
  const hidden = attention.slice(PILL_CAP);

  const HealthyIcon = conditionIcons.healthy;

  return (
    <section
      aria-label="Life Areas by condition"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 pb-3"
    >
      <time
        dateTime={date.toISOString()}
        title={format(date, "EEEE, MMMM d, yyyy")}
        className="inline-flex h-10 shrink-0 items-center text-sm text-muted-foreground"
      >
        <span className="font-semibold text-foreground">
          {/* The weekday spells out where there is room for it. */}
          <span className="sm:hidden">{format(date, "EEE")}</span>
          <span className="hidden sm:inline">{format(date, "EEEE")}</span>
        </span>
        <span className="px-1.5 text-border" aria-hidden>
          ·
        </span>
        <span className="tabular-nums">{format(date, "MMM d")}</span>
      </time>

      {counters.length > 0 && (
        <div className="inline-flex h-10 shrink-0 items-center divide-x divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
          {counters.map((condition) => {
            const StateIcon = conditionIcons[condition];
            return (
              <span
                key={condition}
                title={`${counts[condition]} ${counterLabels[condition]}`}
                className="inline-flex h-full items-center gap-2 px-3"
              >
                <StateIcon
                  aria-hidden
                  className={cn("size-4", conditionTextClassName[condition])}
                />
                <span className="text-sm font-semibold leading-none tabular-nums">
                  {counts[condition]}
                </span>
                <span
                  aria-hidden
                  className="hidden text-xs text-muted-foreground sm:inline"
                >
                  {counterLabels[condition]}
                </span>
                <span className="sr-only">{counterLabels[condition]}</span>
              </span>
            );
          })}
        </div>
      )}

      {pinned.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {pinned.map((area) => (
            <AreaPill key={area.id} area={area} />
          ))}
          {hidden.length > 0 && (
            <span
              title={hidden.map((area) => area.name).join(", ")}
              className="inline-flex h-10 shrink-0 items-center px-1 text-sm tabular-nums text-muted-foreground"
            >
              +{hidden.length} more
            </span>
          )}
        </div>
      ) : (
        <span className="inline-flex h-10 items-center text-sm text-muted-foreground">
          {areas.length === 0 ? "No Life Areas yet" : "Every Area is steady"}
        </span>
      )}

      {counts.healthy > 0 && (
        <span
          title={`${counts.healthy} steady`}
          className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 text-sm text-muted-foreground"
        >
          <HealthyIcon
            aria-hidden
            className={cn("size-4", conditionTextClassName.healthy)}
          />
          <span className="font-medium tabular-nums text-foreground">
            {counts.healthy}
          </span>
          <span aria-hidden className="hidden sm:inline">
            steady
          </span>
          <span className="sr-only">Areas steady</span>
        </span>
      )}
    </section>
  );
}

/**
 * A 40px tappable target that names the Area and its condition. Critical takes
 * the solid condition fill; watch-list Areas stay an outline so one row of
 * pills still has a loudest thing in it.
 */
function AreaPill({ area }: { area: DashboardArea }) {
  const critical = area.condition === "critical";
  const StateIcon = conditionIcons[area.condition];

  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug }}
      title={`${area.name} — ${counterLabels[area.condition]}`}
      className={cn(
        "inline-flex h-10 min-w-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
        critical
          ? cn(conditionPillClassName.critical, "hover:opacity-90")
          : "border-border bg-card hover:bg-muted/70",
      )}
    >
      <AreaIcon icon={area.icon} className="size-4 shrink-0" />
      <span className="max-w-32 truncate sm:max-w-48">{area.name}</span>
      {critical ? (
        <StateIcon aria-hidden className="size-4 shrink-0" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            conditionDotClassName[area.condition],
          )}
        />
      )}
      <span className="sr-only">{counterLabels[area.condition]}</span>
    </Link>
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
