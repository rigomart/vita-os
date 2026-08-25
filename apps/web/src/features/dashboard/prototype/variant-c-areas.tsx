// PROTOTYPE — throwaway (issue #309). Delete with features/dashboard/prototype/.
//
// Variant C — "Condition-grouped". The page asks «is each Area okay?» first and
// «what is next?» second: Areas are the structure, worst Condition first, and
// the attention engine's order survives untouched inside each one. The bet is
// that per-Area legibility beats one undifferentiated global list — you scan
// four or five small inventories you already have a mental model for, instead
// of one ranked run whose rows keep changing neighbours.
//
// Forward time gets one ultra-slim strip on top and nothing else; the rest of
// time lives as annotation on the rows. If the strip turns out to carry no
// weight, the C direction is simply a list of Areas — that is the test.

import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { ArrowRight, CircleDashed } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionDotClassName,
  conditionIcons,
  conditionShort,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "../components/dashboard-model";
import type {
  AttentionDashboardProps,
  AttentionEntry,
  HorizonDay,
  HorizonDot,
  HorizonModel,
  StalenessLevel,
} from "./attention-contract";

import {
  buildAttentionRun,
  buildHorizon,
  dayDelta,
  daysSinceActivity,
  relativeDayLabel,
  stalenessLevel,
} from "./attention-contract";

/** Worst first. Ties fall back to the user's own Area order. */
const conditionRank: Record<Condition, number> = {
  critical: 0,
  needs_attention: 1,
  healthy: 2,
};

/**
 * Backward time as weight, not alarm: a Thread nobody has touched recedes a
 * step at a time and never turns red. Level 0 leaves the row at full strength.
 */
const stalenessClassName: Record<StalenessLevel, string> = {
  0: "",
  1: "opacity-85",
  2: "opacity-70",
  3: "opacity-55",
};

/** The Inbox tail is a reminder, not a work surface. */
const INBOX_PREVIEW = 3;

interface AreaSection {
  area: DashboardArea;
  entries: AttentionEntry[];
}

export function VariantCAreas({
  areas,
  currentDate,
  tasks,
  threads,
}: AttentionDashboardProps) {
  const run = buildAttentionRun(threads, areas, currentDate);

  // The engine ordered the run once; filtering by Area preserves that order,
  // so no section ever re-ranks anything.
  const entriesByArea = new Map<string, AttentionEntry[]>();
  for (const entry of run) {
    const bucket = entriesByArea.get(entry.thread.areaId);
    if (bucket) bucket.push(entry);
    else entriesByArea.set(entry.thread.areaId, [entry]);
  }

  const ordered = [...areas].sort(
    (a, b) =>
      conditionRank[a.condition] - conditionRank[b.condition] ||
      a.order - b.order,
  );

  const sections: AreaSection[] = [];
  const steady: DashboardArea[] = [];
  for (const area of ordered) {
    const entries = entriesByArea.get(area.id) ?? [];
    // A healthy Area with nothing tracked has nothing to say — it collapses
    // into the steady line. An off-healthy one with nothing tracked is itself
    // the information, so it keeps its section.
    if (entries.length === 0 && area.condition === "healthy") steady.push(area);
    else sections.push({ area, entries });
  }

  if (sections.length === 0 && steady.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nothing to look at yet.
      </p>
    );
  }

  const horizon = buildHorizon({ areas, currentDate, tasks, threads });

  return (
    <div className="flex flex-col gap-5">
      <HorizonStrip currentDate={currentDate} model={horizon} />

      <div className="flex flex-col gap-6">
        {sections.map(({ area, entries }) => (
          <AreaSectionBlock
            key={area.id}
            area={area}
            currentDate={currentDate}
            entries={entries}
          />
        ))}
      </div>

      {steady.length > 0 && <SteadyCluster areas={steady} />}

      <InboxTail currentDate={currentDate} tasks={tasks} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Horizon                                                                     */
/* -------------------------------------------------------------------------- */

/** Days near today get the room; the far end compresses to a rumour. */
function tierClassName(delta: number) {
  if (delta <= 6) return "flex-[3]";
  if (delta <= 13) return "flex-[2]";
  return "flex-[1]";
}

function dotRank(dot: HorizonDot) {
  return dot.condition ? conditionRank[dot.condition] : 3;
}

/**
 * A ~10px line of forward time: today at the left, +27d at the right, one
 * Condition-toned dot per day that carries something. No week labels, no
 * ticks, no counts — deliberately near-invisible, to find out whether the
 * ribbon earns its place in a Condition-grouped page at all.
 */
function HorizonStrip({
  currentDate,
  model,
}: {
  currentDate: number;
  model: HorizonModel;
}) {
  const inWindow = model.days.some((day) => day.dots.length > 0);
  if (!inWindow && model.overdue.length === 0 && model.beyond.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delay={150}>
      <section
        aria-label="Dated follow-ups, next four weeks"
        className="flex items-center gap-2"
      >
        {model.overdue.length > 0 && (
          <Tooltip>
            <TooltipTrigger
              className={cn(
                "shrink-0 text-2xs tabular-nums outline-none",
                conditionTextClassName.needs_attention,
              )}
            >
              <span aria-hidden>◂ </span>
              {model.overdue.length} waiting
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <DotList currentDate={currentDate} dots={model.overdue} />
            </TooltipContent>
          </Tooltip>
        )}

        <div className="relative flex h-2.5 min-w-0 flex-1 items-center">
          <span
            aria-hidden
            className="absolute inset-x-0 top-1/2 h-px bg-border/70"
          />
          {model.days.map((day) => (
            <HorizonCell key={day.date} currentDate={currentDate} day={day} />
          ))}
        </div>

        {model.beyond.length > 0 && (
          <Tooltip>
            <TooltipTrigger className="shrink-0 text-2xs tabular-nums text-muted-foreground/70 outline-none">
              {model.beyond.length} later
              <span aria-hidden> ▸</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <DotList currentDate={currentDate} dots={model.beyond} />
            </TooltipContent>
          </Tooltip>
        )}
      </section>
    </TooltipProvider>
  );
}

function HorizonCell({
  currentDate,
  day,
}: {
  currentDate: number;
  day: HorizonDay;
}) {
  const today = day.dayDelta === 0;
  const shell = cn(
    "relative flex h-2.5 items-center justify-center",
    tierClassName(day.dayDelta),
  );
  const todayTick = today && (
    <span
      aria-hidden
      className="absolute inset-y-0 left-0 w-px bg-brand-gold-strong"
    />
  );

  // An empty day is scenery, not content — 28 announced dates would drown the
  // few that carry something.
  if (day.dots.length === 0) {
    return (
      <span aria-hidden className={shell}>
        {todayTick}
      </span>
    );
  }

  const worst = [...day.dots].sort((a, b) => dotRank(a) - dotRank(b))[0];
  const tone = worst?.condition
    ? conditionDotClassName[worst.condition]
    : "bg-muted-foreground/50";

  return (
    <Tooltip>
      <TooltipTrigger className={cn(shell, "outline-none")}>
        {todayTick}
        <span
          aria-hidden
          className={cn(
            "rounded-full",
            tone,
            day.dots.length > 1 ? "size-2" : "size-1.5",
          )}
        />
        <span className="sr-only">
          {day.dots.length} on {relativeDayLabel(day.date, currentDate)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <DotList currentDate={currentDate} dots={day.dots} />
      </TooltipContent>
    </Tooltip>
  );
}

function DotList({
  currentDate,
  dots,
}: {
  currentDate: number;
  dots: HorizonDot[];
}) {
  const shown = dots.slice(0, 5);
  return (
    <span className="flex flex-col gap-0.5 text-left">
      {shown.map((dot) => (
        <span key={dot.id}>
          <span className="tabular-nums opacity-70">
            {relativeDayLabel(dot.date, currentDate)}
          </span>{" "}
          {dot.label}
        </span>
      ))}
      {dots.length > shown.length && (
        <span className="opacity-70">+{dots.length - shown.length} more</span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Area sections                                                               */
/* -------------------------------------------------------------------------- */

function AreaSectionBlock({
  area,
  currentDate,
  entries,
}: {
  area: DashboardArea;
  currentDate: number;
  entries: AttentionEntry[];
}) {
  return (
    <section aria-label={area.name}>
      <AreaHeader area={area} currentDate={currentDate} entries={entries} />
      {entries.length === 0 ? (
        <p className="px-2 py-1.5 text-2xs text-muted-foreground/70 italic">
          No open threads
        </p>
      ) : (
        <div className="mt-0.5">
          {entries.map((entry) => (
            <ThreadRow
              key={entry.thread.id}
              currentDate={currentDate}
              thread={entry.thread}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Who this Area is, how it is doing, and — quietly, on the right — the two
 * facts a glance wants next: the soonest clock on it, and how long since
 * anything moved here at all.
 */
function AreaHeader({
  area,
  currentDate,
  entries,
}: {
  area: DashboardArea;
  currentDate: number;
  entries: AttentionEntry[];
}) {
  const ConditionIcon = conditionIcons[area.condition];
  const threads = entries.map((entry) => entry.thread);
  const soonest = soonestFollowUp(threads);
  const quietDays = areaQuietDays(threads, currentDate);
  const late = soonest !== undefined && dayDelta(soonest, currentDate) < 0;

  return (
    <div className="flex items-baseline gap-2 border-b border-border/50 pb-1">
      <Link
        to="/$areaSlug"
        params={{ areaSlug: area.slug }}
        className="group flex min-w-0 items-center gap-2 rounded-sm outline-none"
      >
        <AreaIcon
          icon={area.icon}
          className={cn(
            "size-4 shrink-0",
            conditionTextClassName[area.condition],
          )}
        />
        <span className="truncate font-heading text-sm font-semibold tracking-tight underline-offset-4 group-hover:underline">
          {area.name}
        </span>
      </Link>

      <span
        className={cn(
          "flex shrink-0 items-center gap-1 text-2xs",
          conditionTextClassName[area.condition],
        )}
      >
        <ConditionIcon aria-hidden className="size-3.5" />
        {conditionShort[area.condition]}
      </span>

      <span aria-hidden className="h-px min-w-4 flex-1 bg-border/40" />

      <span className="flex shrink-0 items-baseline gap-2 text-2xs tabular-nums text-muted-foreground">
        {soonest !== undefined && (
          <span className={cn(late && conditionTextClassName.needs_attention)}>
            follow up · {relativeDayLabel(soonest, currentDate)}
          </span>
        )}
        {quietDays !== undefined && (
          <span className="text-muted-foreground/60">quiet {quietDays}d</span>
        )}
      </span>
    </div>
  );
}

/**
 * One Thread, ~40px. No Area tag — the section it sits in already said that,
 * which is exactly the room this direction buys back.
 */
function ThreadRow({
  currentDate,
  thread,
}: {
  currentDate: number;
  thread: DashboardThread;
}) {
  const nextMove = thread.nextMove?.trim();
  const summary = thread.summary?.trim();
  const detail = nextMove || summary;
  const staleness = stalenessLevel(thread, currentDate);
  const quiet = daysSinceActivity(thread, currentDate);

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, thread: thread.slug })}
      title={quiet === undefined ? undefined : `Last activity ${quiet}d ago`}
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-md px-2 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50",
        stalenessClassName[staleness],
      )}
    >
      <ProximityRail currentDate={currentDate} followUp={thread.followUp} />

      <span
        className={cn(
          "min-w-0 truncate text-sm font-medium",
          detail ? "max-w-[55%] shrink-0" : "flex-1",
        )}
      >
        {thread.title}
      </span>

      {detail && (
        <span className="flex min-w-0 flex-1 items-baseline gap-1 text-2xs text-muted-foreground/80">
          {nextMove && (
            <ArrowRight
              aria-hidden
              className="size-3 shrink-0 translate-y-0.5"
            />
          )}
          <span className="truncate">{detail}</span>
        </span>
      )}
    </Link>
  );
}

/** Time as annotation: a fixed-width left gutter, never a position. */
function ProximityRail({
  currentDate,
  followUp,
}: {
  currentDate: number;
  followUp?: number;
}) {
  if (followUp === undefined) {
    return (
      <span
        aria-hidden
        className="w-14 shrink-0 text-right text-2xs text-muted-foreground/35"
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
        "w-14 shrink-0 text-right text-2xs tabular-nums",
        delta < 0
          ? cn("font-medium", conditionTextClassName.needs_attention)
          : delta <= 1
            ? "font-medium text-foreground/80"
            : "text-muted-foreground",
      )}
    >
      {relativeDayLabel(followUp, currentDate)}
    </time>
  );
}

/* -------------------------------------------------------------------------- */
/* Tails                                                                       */
/* -------------------------------------------------------------------------- */

/** Healthy and empty: named, reachable, and given one line between them all. */
function SteadyCluster({ areas }: { areas: DashboardArea[] }) {
  const SteadyIcon = conditionIcons.healthy;
  return (
    <section
      aria-label="Steady areas"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 pt-3 text-2xs text-muted-foreground"
    >
      <span className="flex shrink-0 items-center gap-1">
        <SteadyIcon
          aria-hidden
          className={cn("size-3.5", conditionTextClassName.healthy)}
        />
        Steady
      </span>
      {areas.map((area) => (
        <Link
          key={area.id}
          to="/$areaSlug"
          params={{ areaSlug: area.slug }}
          className="flex min-w-0 items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground"
        >
          <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
          <span className="truncate">{area.name}</span>
        </Link>
      ))}
    </section>
  );
}

/** The Inbox reports in, it does not compete: header, three dated lines, done. */
function InboxTail({
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
  const shown = dated.slice(0, INBOX_PREVIEW);
  const rest = tasks.length - shown.length;

  return (
    <section
      aria-label="Inbox"
      className="border-t border-border/50 pt-3 text-muted-foreground"
    >
      <Link
        to="."
        search={(prev) => ({ ...prev, inbox: true })}
        className="inline-flex items-center gap-1.5 rounded-sm text-2xs outline-none transition-colors hover:text-foreground"
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
                  "w-14 shrink-0 text-right text-2xs tabular-nums",
                  dayDelta(task.when, currentDate) < 0
                    ? conditionTextClassName.needs_attention
                    : "text-muted-foreground/70",
                )}
              >
                {relativeDayLabel(task.when, currentDate)}
              </time>
              <span className="min-w-0 truncate text-2xs text-muted-foreground">
                {task.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      {rest > 0 && (
        <p className="mt-1 px-2 text-2xs tabular-nums text-muted-foreground/60">
          +{rest} more
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Derivations                                                                 */
/* -------------------------------------------------------------------------- */

function soonestFollowUp(threads: DashboardThread[]) {
  let soonest: number | undefined;
  for (const thread of threads) {
    if (thread.followUp === undefined) continue;
    if (soonest === undefined || thread.followUp < soonest) {
      soonest = thread.followUp;
    }
  }
  return soonest;
}

/**
 * How long the whole Area has been silent — the most recent Activity Log entry
 * across its Threads. Fresh (under a week) or unrecorded says nothing.
 */
function areaQuietDays(threads: DashboardThread[], currentDate: number) {
  let freshest: DashboardThread | undefined;
  for (const thread of threads) {
    if (thread.lastActivityAt === undefined) continue;
    if (
      freshest?.lastActivityAt === undefined ||
      thread.lastActivityAt > freshest.lastActivityAt
    ) {
      freshest = thread;
    }
  }
  if (!freshest) return undefined;
  const days = daysSinceActivity(freshest, currentDate);
  return days !== undefined && days >= 7 ? days : undefined;
}
