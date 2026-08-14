// PROTOTYPE — throwaway.
// Variant idea: the command bar with the counters cut out — the space goes to
// "why", so each attention Area reads as «icon» Name — reason, healthy Areas
// trailing as a glyph cluster.
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

/** Past four reasons the row costs more height than the extra names are worth. */
const REASON_CAP = 4;

interface AreaReason {
  /** Present when a Thread put a clock on it. */
  due?: { label: string; overdue: boolean };
  /** Undefined when the Area has nothing captured at all. */
  text?: string;
}

export function HeroVariantReasonsBar({
  areas,
  threads,
  currentDate,
}: DashboardHeroProps) {
  const date = new Date(currentDate);
  const threadsByArea = groupByArea(threads);

  const attention = areas
    .filter((area) => area.condition !== "healthy")
    .sort(worstFirst);
  const shown = attention.slice(0, REASON_CAP);
  const hidden = attention.slice(REASON_CAP);
  const steady = areas
    .filter((area) => area.condition === "healthy")
    .sort((a, b) => a.order - b.order);

  const SteadyIcon = conditionIcons.healthy;

  return (
    <section
      aria-label="Life Areas by condition"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-3"
    >
      <time
        dateTime={date.toISOString()}
        title={format(date, "EEEE, MMMM d, yyyy")}
        className="shrink-0 text-xs text-muted-foreground"
      >
        <span className="font-semibold text-foreground">
          {format(date, "EEE")}
        </span>{" "}
        · {format(date, "MMM d")}
      </time>

      {shown.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          {shown.map((area, index) => (
            <div
              key={area.id}
              className="flex min-w-0 max-w-full items-center gap-3"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className="hidden h-4 w-px shrink-0 bg-border sm:block"
                />
              )}
              <ReasonGroup
                area={area}
                currentDate={currentDate}
                threads={threadsByArea.get(area.id) ?? []}
              />
            </div>
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
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <SteadyIcon
            aria-hidden
            className={cn("size-4 shrink-0", conditionTextClassName.healthy)}
          />
          <span className="truncate font-medium">
            {areas.length === 0
              ? "No Life Areas yet"
              : `All ${areas.length} areas steady`}
          </span>
        </span>
      )}

      {steady.length > 0 && (
        <span className="flex min-w-0 flex-wrap items-center gap-0.5 sm:ml-auto">
          {steady.map((area) => (
            <Link
              key={area.id}
              to="/$areaSlug"
              params={{ areaSlug: area.slug }}
              title={`${area.name} — steady`}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <AreaIcon icon={area.icon} className="size-3.5" />
              <span className="sr-only">{area.name}</span>
            </Link>
          ))}
        </span>
      )}
    </section>
  );
}

/** One Area's share of the bar: who it is, and the single reason it is here. */
function ReasonGroup({
  area,
  threads,
  currentDate,
}: {
  area: DashboardArea;
  currentDate: number;
  threads: DashboardThread[];
}) {
  const reason = areaReason(threads, currentDate);

  return (
    <Link
      to="/$areaSlug"
      params={{ areaSlug: area.slug }}
      title={area.name}
      className="group flex min-w-0 max-w-full items-center gap-1.5 rounded-sm px-1 py-1 transition-colors hover:bg-muted/60 sm:max-w-[20rem]"
    >
      <AreaIcon
        icon={area.icon}
        className={cn(
          "size-4 shrink-0",
          conditionTextClassName[area.condition],
        )}
      />
      <span className="max-w-[9rem] shrink-0 truncate text-sm font-medium underline-offset-4 group-hover:underline">
        {area.name}
      </span>
      <span aria-hidden className="shrink-0 text-xs text-muted-foreground/50">
        —
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-xs text-muted-foreground",
          !reason.text && !reason.due && "italic text-muted-foreground/70",
        )}
      >
        {reason.due && (
          <span
            className={cn(
              "font-medium tabular-nums",
              reason.due.overdue
                ? "text-condition-critical"
                : "text-foreground/80",
            )}
          >
            {reason.due.overdue
              ? `Late · ${reason.due.label}`
              : reason.due.label}
          </span>
        )}
        {reason.due && reason.text ? " · " : ""}
        {reason.text ?? (reason.due ? "" : "Nothing captured")}
      </span>
    </Link>
  );
}

/**
 * The Area's "why", in the order a person would say it out loud: the soonest
 * dated Thread wins, then any captured next move, then the last thing that
 * happened here.
 */
function areaReason(
  threads: DashboardThread[],
  currentDate: number,
): AreaReason {
  const soonest = threads
    .filter(
      (thread): thread is DashboardThread & { followUp: number } =>
        thread.followUp !== undefined,
    )
    .sort((a, b) => a.followUp - b.followUp)[0];

  if (soonest) {
    return {
      text: soonest.nextMove ?? soonest.title,
      due: {
        label: followUpDateLabel(soonest.followUp, currentDate),
        overdue:
          startOfLocalDay(soonest.followUp) < startOfLocalDay(currentDate),
      },
    };
  }

  const moved = [...threads]
    .sort((a, b) => a.order - b.order)
    .find((thread) => thread.nextMove);
  if (moved?.nextMove) return { text: moved.nextMove };

  const recent = threads
    .filter((thread) => thread.lastActivityContent)
    .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))[0];
  if (recent?.lastActivityContent) return { text: recent.lastActivityContent };

  return {};
}

function groupByArea(threads: DashboardThread[]) {
  const byArea = new Map<string, DashboardThread[]>();
  for (const thread of threads) {
    const bucket = byArea.get(thread.areaId);
    if (bucket) bucket.push(thread);
    else byArea.set(thread.areaId, [thread]);
  }
  return byArea;
}

function worstFirst(a: DashboardArea, b: DashboardArea) {
  const rank = (area: DashboardArea) => (area.condition === "critical" ? 0 : 1);
  return rank(a) - rank(b) || a.order - b.order;
}
