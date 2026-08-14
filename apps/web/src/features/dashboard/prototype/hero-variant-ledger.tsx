// PROTOTYPE — throwaway.
// Variant "Attention ledger": one full-width row per attention-bearing Area —
// condition marker, name, and the actual next move pulled off its Threads —
// with every healthy Area collapsed into a single steady row at the bottom.
import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";

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

/** Past this, extra attention Areas fold into a glyph row so the phone stays scannable. */
const LEDGER_CAP = 6;

const conditionRailClassName: Record<Condition, string> = {
  healthy: "border-condition-healthy/40",
  needs_attention: "border-condition-attention/70",
  critical: "border-condition-critical",
};

const attentionLabels: Partial<Record<Condition, string>> = {
  critical: "Needs you",
  needs_attention: "Watch",
};

interface LedgerDue {
  label: string;
  overdue: boolean;
}

interface LedgerReason {
  due?: LedgerDue;
  text: string;
}

function byOrder(a: DashboardArea, b: DashboardArea) {
  return a.order - b.order;
}

/**
 * The row's "why": the soonest follow-up wins (it is the thing with a clock on
 * it), then any captured next move, then the last thing that happened. Areas
 * with none of the three say so rather than showing an empty line.
 */
function ledgerReason(
  threads: DashboardThread[],
  currentDate: number,
): LedgerReason | undefined {
  const dated = threads
    .filter(
      (thread): thread is DashboardThread & { followUp: number } =>
        thread.followUp !== undefined,
    )
    .sort((a, b) => a.followUp - b.followUp);

  const soonest = dated[0];
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

  return undefined;
}

export function HeroVariantLedger({
  areas,
  threads,
  currentDate,
}: DashboardHeroProps) {
  const threadsByArea = new Map<string, DashboardThread[]>();
  for (const thread of threads) {
    const bucket = threadsByArea.get(thread.areaId);
    if (bucket) bucket.push(thread);
    else threadsByArea.set(thread.areaId, [thread]);
  }

  const critical = areas
    .filter((area) => area.condition === "critical")
    .sort(byOrder);
  const watching = areas
    .filter((area) => area.condition === "needs_attention")
    .sort(byOrder);
  const steady = areas
    .filter((area) => area.condition === "healthy")
    .sort(byOrder);

  const attention = [...critical, ...watching];
  const listed = attention.slice(0, LEDGER_CAP);
  const overflow = attention.slice(LEDGER_CAP);
  const date = new Date(currentDate);

  return (
    <section aria-label="Areas needing attention" className="flex flex-col">
      <h2 className="sr-only">Attention ledger</h2>

      <div className="flex items-baseline justify-between gap-3 pb-1.5">
        <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {attention.length === 0
            ? "Nothing needs you"
            : `${attention.length} ${attention.length === 1 ? "area needs" : "areas need"} you`}
        </p>
        <time
          dateTime={date.toISOString()}
          title={format(date, "EEEE, MMMM d, yyyy")}
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70"
        >
          {format(date, "EEE, MMM d")}
        </time>
      </div>

      {attention.length === 0 ? (
        <SteadyCalm areas={steady} />
      ) : (
        <ul className="divide-y divide-border/50 border-y border-border/50">
          {listed.map((area) => (
            <LedgerRow
              key={area.id}
              area={area}
              currentDate={currentDate}
              threads={threadsByArea.get(area.id) ?? []}
            />
          ))}
          {overflow.length > 0 && <OverflowRow areas={overflow} />}
          {steady.length > 0 && <SteadyRow areas={steady} />}
        </ul>
      )}
    </section>
  );
}

function LedgerRow({
  area,
  threads,
  currentDate,
}: {
  area: DashboardArea;
  currentDate: number;
  threads: DashboardThread[];
}) {
  const StateIcon = conditionIcons[area.condition];
  const reason = ledgerReason(threads, currentDate);

  return (
    <li>
      <Link
        to="/$areaSlug"
        params={{ areaSlug: area.slug }}
        className={cn(
          "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 py-2.5 pr-1 pl-2.5 transition-colors hover:bg-muted/40",
          conditionRailClassName[area.condition],
        )}
      >
        <StateIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            conditionTextClassName[area.condition],
          )}
        />

        <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
          <span className="flex min-w-0 items-baseline gap-1.5 sm:max-w-[40%] sm:shrink-0">
            <span className="truncate text-sm font-semibold leading-tight">
              {area.name}
            </span>
            <span
              className={cn(
                "shrink-0 text-[10px] font-medium uppercase tracking-wide",
                conditionTextClassName[area.condition],
              )}
            >
              {attentionLabels[area.condition]}
            </span>
          </span>
          <span
            className={cn(
              "mt-0.5 min-w-0 truncate text-xs text-muted-foreground sm:mt-0 sm:flex-1",
              !reason && "italic text-muted-foreground/70",
            )}
          >
            {reason?.text ?? "No next move captured"}
          </span>
        </div>

        <span className="flex shrink-0 items-center gap-1 pl-1">
          {reason?.due && (
            <span
              className={cn(
                "text-[11px] tabular-nums",
                reason.due.overdue
                  ? "font-semibold text-condition-critical"
                  : "text-muted-foreground",
              )}
            >
              {reason.due.overdue ? "Late · " : ""}
              {reason.due.label}
            </span>
          )}
          <ChevronRight
            aria-hidden
            className="size-3.5 text-transparent transition-colors group-hover:text-muted-foreground"
          />
        </span>
      </Link>
    </li>
  );
}

/** Attention Areas past the cap: still reachable, but out of the reading path. */
function OverflowRow({ areas }: { areas: DashboardArea[] }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-border/60 py-2 pr-1 pl-2.5">
      <span className="text-xs text-muted-foreground">
        +{areas.length} more flagged
      </span>
      <AreaGlyphs areas={areas} />
    </li>
  );
}

/** Every healthy Area, one line, name-free. */
function SteadyRow({ areas }: { areas: DashboardArea[] }) {
  const SteadyIcon = conditionIcons.healthy;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-condition-healthy/30 py-2 pr-1 pl-2.5">
      <SteadyIcon
        aria-hidden
        className={cn("size-3.5 shrink-0", conditionTextClassName.healthy)}
      />
      <span className="text-xs tabular-nums text-muted-foreground">
        {areas.length} steady
      </span>
      <AreaGlyphs areas={areas} />
    </li>
  );
}

/** The zero-attention ledger: one line, deliberately quiet. */
function SteadyCalm({ areas }: { areas: DashboardArea[] }) {
  const SteadyIcon = conditionIcons.healthy;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-border/50 border-l-2 border-l-condition-healthy/40 py-3 pr-1 pl-2.5">
      <SteadyIcon
        aria-hidden
        className={cn("size-4 shrink-0", conditionTextClassName.healthy)}
      />
      <span className="text-sm font-semibold">
        {areas.length === 0
          ? "Nothing tracked yet"
          : `All ${areas.length} areas steady`}
      </span>
      <span className="text-xs text-muted-foreground">
        Nothing is asking for you today.
      </span>
      <AreaGlyphs areas={areas} className="sm:ml-auto" />
    </div>
  );
}

function AreaGlyphs({
  areas,
  className,
}: {
  areas: DashboardArea[];
  className?: string;
}) {
  if (areas.length === 0) return null;

  return (
    <span
      className={cn("flex min-w-0 flex-wrap items-center gap-0.5", className)}
    >
      {areas.map((area) => (
        <Link
          key={area.id}
          to="/$areaSlug"
          params={{ areaSlug: area.slug }}
          title={area.name}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <AreaIcon icon={area.icon} className="size-3.5" />
          <span className="sr-only">{area.name}</span>
        </Link>
      ))}
    </span>
  );
}
