// PROTOTYPE — throwaway (issue #309). Delete with features/dashboard/prototype/.

import { Link } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { format } from "date-fns";
import { ArrowRight, ChevronLeft, Inbox } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionDotClassName,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type {
  AttentionDashboardProps,
  AttentionEntry,
  HorizonDay,
  HorizonDot,
  StalenessLevel,
} from "./attention-contract";

import {
  buildAttentionRun,
  buildHorizon,
  dayDelta,
  relativeDayLabel,
  stalenessLevel,
} from "./attention-contract";

/** Past four dots a day column stops drawing and starts counting. */
const MAX_DOTS = 4;
/** Tooltips list this many items before summarising the rest. */
const MAX_TOOLTIP_ITEMS = 6;
/** How long the scrolled-to row keeps its ring. */
const FLASH_MS = 1600;

/**
 * Variant A — "Horizon ribbon".
 *
 * The attention run owns vertical position, top to bottom, exactly as the
 * engine hands it over. Forward time never becomes layout: it is compressed
 * into a read-only silhouette above the list, where the next week is drawn
 * wide and the fourth week is a hairline. Clicking the ribbon does not filter
 * or reorder anything — it just walks you to the row that already exists.
 */
export function VariantARibbon({
  areas,
  currentDate,
  tasks,
  threads,
}: AttentionDashboardProps) {
  const run = buildAttentionRun(threads, areas, currentDate);
  const horizon = buildHorizon({ areas, currentDate, tasks, threads });
  const [flashId, setFlashId] = useState<string | undefined>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const focusThread = (threadId: string) => {
    document
      .getElementById(`attn-${threadId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    clearTimeout(flashTimer.current);
    setFlashId(threadId);
    flashTimer.current = setTimeout(() => setFlashId(undefined), FLASH_MS);
  };

  if (run.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nothing is asking for you right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <HorizonRibbon
        beyond={horizon.beyond}
        days={horizon.days}
        overdue={horizon.overdue}
        onFocusThread={focusThread}
      />

      {tasks.length > 0 && (
        <Link
          to="."
          search={(prev) => ({ ...prev, inbox: true })}
          className="flex w-fit items-center gap-1.5 rounded-sm text-2xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Inbox aria-hidden className="size-3.5" />
          <span>Inbox · {tasks.length} open</span>
        </Link>
      )}

      <ol aria-label="Threads in attention order" className="flex flex-col">
        {run.map((entry, index) => (
          <Fragment key={entry.thread.id}>
            {index > 0 && run[index - 1]?.group !== entry.group && (
              <li aria-hidden className="ml-16 h-px shrink-0 bg-border/50" />
            )}
            <AttentionRunRow
              currentDate={currentDate}
              entry={entry}
              flashed={flashId === entry.thread.id}
            />
          </Fragment>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ribbon                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Today → +27d as one slim band. Day widths decay in three tiers (4 / 2 / 1),
 * so the week you can actually act on gets the resolution and the far edge
 * survives as texture. No item is ever *placed* by its date — only counted.
 */
function HorizonRibbon({
  beyond,
  days,
  onFocusThread,
  overdue,
}: {
  beyond: HorizonDot[];
  days: HorizonDay[];
  onFocusThread: (threadId: string) => void;
  overdue: HorizonDot[];
}) {
  const firstThread = (dots: HorizonDot[]) =>
    dots.find((dot) => dot.kind === "thread");

  return (
    <TooltipProvider delay={150}>
      <section
        aria-label="Next four weeks"
        className="flex items-stretch gap-2 rounded-lg border border-border/60 bg-surface-2 px-2 py-1.5"
      >
        {overdue.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const dot = firstThread(overdue);
              if (dot) onFocusThread(dot.id);
            }}
            className="flex shrink-0 items-center gap-1 self-end rounded-md bg-surface-3 px-2 py-1 text-2xs font-medium whitespace-nowrap text-condition-attention transition-colors hover:bg-muted"
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            {overdue.length} waiting
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <WeekLabels />
          <div className="flex h-11 items-stretch border-b border-border/50">
            {days.map((day) => (
              <HorizonDayColumn
                key={day.dayDelta}
                day={day}
                onFocusThread={onFocusThread}
              />
            ))}
          </div>
        </div>

        {beyond.length > 0 && (
          <span className="shrink-0 self-end py-1 text-2xs whitespace-nowrap text-muted-foreground/70 tabular-nums">
            +{beyond.length} later
          </span>
        )}
      </section>
    </TooltipProvider>
  );
}

/** Segment widths mirror the day tiers below: 7×4, 7×2, 14×1. */
function WeekLabels() {
  const segments = [
    { grow: 28, label: "This week", tick: false },
    { grow: 14, label: "Next week", tick: true },
    { grow: 14, label: "Later", tick: true },
  ];
  return (
    <div aria-hidden className="flex items-end">
      {segments.map((segment) => (
        <span
          key={segment.label}
          style={{ flexBasis: 0, flexGrow: segment.grow }}
          className={cn(
            "min-w-0 truncate pl-1 text-2xs text-muted-foreground/60",
            segment.tick && "border-l border-border/60",
          )}
        >
          {segment.label}
        </span>
      ))}
    </div>
  );
}

/** Near days are wide, far days are slivers — resolution follows usefulness. */
function dayTier(delta: number) {
  if (delta <= 6) return 4;
  if (delta <= 13) return 2;
  return 1;
}

function HorizonDayColumn({
  day,
  onFocusThread,
}: {
  day: HorizonDay;
  onFocusThread: (threadId: string) => void;
}) {
  const today = day.dayDelta === 0;
  const weekStart = day.dayDelta === 7 || day.dayDelta === 14;
  const shown = day.dots.slice(0, MAX_DOTS);
  const hidden = day.dots.length - shown.length;
  const dayLabel = format(new Date(day.date), "EEE, MMM d");

  const className = cn(
    "relative flex min-w-0 flex-col-reverse items-center justify-start gap-[3px] pb-1.5",
    today && "rounded-t-sm bg-surface-3",
    weekStart && "border-l border-border/60",
  );
  const style = { flexBasis: 0, flexGrow: dayTier(day.dayDelta) };

  const marker = today ? (
    <span
      aria-hidden
      className="absolute inset-x-0.5 bottom-0 h-0.5 rounded-full bg-brand-gold-strong"
    />
  ) : undefined;

  const stack = (
    <>
      {marker}
      {hidden > 0 && (
        <span className="text-2xs leading-none text-muted-foreground/70 tabular-nums">
          +{hidden}
        </span>
      )}
      {shown.map((dot) => (
        <span
          key={dot.id}
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            dot.kind === "task"
              ? "border border-muted-foreground/60"
              : dot.condition
                ? conditionDotClassName[dot.condition]
                : "bg-muted-foreground/40",
          )}
        />
      ))}
    </>
  );

  if (day.dots.length === 0) {
    return (
      <div className={className} style={style}>
        {marker}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`${dayLabel} — ${day.dots.length} item${day.dots.length === 1 ? "" : "s"}`}
            onClick={() => {
              const dot = day.dots.find((item) => item.kind === "thread");
              if (dot) onFocusThread(dot.id);
            }}
            style={style}
            className={cn(
              className,
              "cursor-pointer outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
          />
        }
      >
        {stack}
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={8}
        className="flex-col items-start gap-0.5"
      >
        <span className="font-medium">{dayLabel}</span>
        {day.dots.slice(0, MAX_TOOLTIP_ITEMS).map((dot) => (
          <span key={dot.id} className="flex items-center gap-1.5 opacity-80">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                dot.kind === "task"
                  ? "border border-current"
                  : dot.condition
                    ? conditionDotClassName[dot.condition]
                    : "bg-current",
              )}
            />
            <span className="truncate">{dot.label}</span>
          </span>
        ))}
        {day.dots.length > MAX_TOOLTIP_ITEMS && (
          <span className="opacity-60">
            +{day.dots.length - MAX_TOOLTIP_ITEMS} more
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/* Run                                                                        */
/* -------------------------------------------------------------------------- */

/** Backward time is a fade, never a scold: four steps, none of them alarming. */
const stalenessClassName: Record<StalenessLevel, string> = {
  0: "",
  1: "opacity-90",
  2: "opacity-75",
  3: "opacity-60",
};

/**
 * One ~40px row. Left: a fixed proximity rail whose intensity decays with
 * distance — the only place a date appears. Right: the Area, toned by its
 * Condition and always named, never colour alone.
 */
function AttentionRunRow({
  currentDate,
  entry,
  flashed,
}: {
  currentDate: number;
  entry: AttentionEntry;
  flashed: boolean;
}) {
  const { area, thread } = entry;
  const nextMove = thread.nextMove?.trim();
  const summary = thread.summary?.trim();
  const detail = nextMove || summary;

  return (
    <li>
      <Link
        to="."
        search={(prev) => ({ ...prev, thread: thread.slug })}
        id={`attn-${thread.id}`}
        className={cn(
          "flex h-10 items-center gap-3 rounded-md px-2 outline-none transition-[background-color,opacity] hover:bg-muted/60 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none",
          stalenessClassName[stalenessLevel(thread, currentDate)],
          flashed && "bg-muted ring-2 ring-brand-gold-strong",
        )}
      >
        <ProximityRail followUp={thread.followUp} currentDate={currentDate} />

        <span
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            detail ? "max-w-[45%] shrink-0" : "flex-1",
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

        {area && (
          <span
            className={cn(
              "flex w-32 shrink-0 items-center justify-end gap-1 text-2xs",
              conditionTextClassName[area.condition],
            )}
          >
            <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
            <span className="truncate">{area.name}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

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
        className="w-16 shrink-0 text-right text-2xs text-muted-foreground/40"
      >
        —
      </span>
    );
  }

  const delta = dayDelta(followUp, currentDate);
  const tone =
    delta < 0
      ? "font-semibold text-condition-attention"
      : delta <= 1
        ? "font-semibold text-foreground"
        : delta <= 6
          ? "text-foreground/70"
          : "text-muted-foreground/70";

  return (
    <time
      dateTime={new Date(followUp).toISOString()}
      className={cn(
        "w-16 shrink-0 truncate text-right text-2xs tabular-nums",
        tone,
      )}
    >
      {relativeDayLabel(followUp, currentDate)}
    </time>
  );
}
