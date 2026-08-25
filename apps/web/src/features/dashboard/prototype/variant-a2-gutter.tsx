// PROTOTYPE — throwaway (issue #309). Delete with features/dashboard/prototype/.

import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { ArrowRight, Inbox, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionDotClassName,
  conditionIcons,
  conditionShort,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type {
  AttentionDashboardProps,
  AttentionEntry,
  HorizonDot,
  HorizonModel,
  StalenessLevel,
} from "./attention-contract";

import {
  buildAttentionRun,
  buildHorizon,
  dayDelta,
  relativeDayLabel,
  stalenessLevel,
} from "./attention-contract";

/**
 * Variant A2 — "Time gutter".
 *
 * The flat attention run owns vertical position, exactly as in A. The forward
 * horizon is turned ninety degrees: a sticky vertical scale to the LEFT of the
 * list, Today at the top and +28d at the bottom, non-linear so this week gets
 * half the height. Dated rows and their dots are linked by hover — the crossing
 * between "how much this matters" (row order) and "when it lands" (dot height)
 * is the thing the variant is trying to make perceivable.
 */
export function VariantA2Gutter(props: AttentionDashboardProps) {
  const { areas, currentDate, tasks, threads } = props;
  const run = useMemo(
    () => buildAttentionRun(threads, areas, currentDate),
    [threads, areas, currentDate],
  );
  const horizon = useMemo(
    () => buildHorizon({ areas, currentDate, tasks, threads }),
    [areas, currentDate, tasks, threads],
  );

  // One shared id: a thread id from either side of the gutter, or the sentinel
  // "inbox" which lights every Task dot at once.
  const [hovered, setHovered] = useState<string | undefined>(undefined);

  if (run.length === 0) {
    return (
      <p className="py-12 text-sm text-muted-foreground">
        Nothing open — the Areas above are the whole picture right now.
      </p>
    );
  }

  return (
    <div className="flex gap-4">
      <TimeGutter
        currentDate={currentDate}
        horizon={horizon}
        hovered={hovered}
        onHover={setHovered}
      />

      <div className="min-w-0 flex-1">
        <ol className="flex flex-col">
          {run.map((entry) => (
            <GutterRow
              key={entry.thread.id}
              currentDate={currentDate}
              entry={entry}
              hovered={hovered}
              onHover={setHovered}
            />
          ))}
        </ol>

        {tasks.length > 0 && (
          <Link
            to="."
            search={(previous) => ({ ...previous, inbox: true })}
            onMouseEnter={() => setHovered("inbox")}
            onMouseLeave={() => setHovered(undefined)}
            className="mt-1 flex h-8 items-center gap-2 rounded-md pl-3 text-2xs text-muted-foreground outline-none transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Inbox aria-hidden className="size-3.5 shrink-0" />
            <span className="tabular-nums">Inbox · {tasks.length} open</span>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the list */

const stalenessClassName: Record<StalenessLevel, string> = {
  0: "",
  1: "opacity-90",
  2: "opacity-75",
  3: "opacity-60",
};

/** One dense row: proximity rail, title, detail, Area. ~40px, read-only. */
function GutterRow({
  currentDate,
  entry,
  hovered,
  onHover,
}: {
  currentDate: number;
  entry: AttentionEntry;
  hovered: string | undefined;
  onHover: (id: string | undefined) => void;
}) {
  const { area, thread } = entry;
  const followUp = thread.followUp;
  const delta =
    followUp === undefined ? undefined : dayDelta(followUp, currentDate);
  const nextMove = thread.nextMove?.trim();
  const detail = nextMove || thread.summary?.trim();
  const active = hovered === thread.id;

  return (
    <li>
      <Link
        to="."
        search={(previous) => ({ ...previous, thread: thread.slug })}
        onMouseEnter={() => onHover(thread.id)}
        onMouseLeave={() => onHover(undefined)}
        className={cn(
          "group relative flex h-10 items-center gap-3 rounded-md pr-2 pl-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30",
          stalenessClassName[stalenessLevel(thread, currentDate)],
          active && "bg-muted/50 opacity-100",
        )}
      >
        {/* Echo of this row's dot on the scale — same tone, same hover. */}
        {delta !== undefined && (
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 left-0 w-0.5 -translate-y-1/2 rounded-full transition-all",
              dotToneClassName(area?.condition),
              active ? "h-6 opacity-100" : "h-4 opacity-50",
            )}
          />
        )}

        <span
          className={cn(
            "w-16 shrink-0 truncate text-right text-2xs tabular-nums",
            proximityToneClassName(delta),
          )}
        >
          {followUp === undefined
            ? "—"
            : relativeDayLabel(followUp, currentDate)}
        </span>

        <span
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            detail ? "max-w-[50%] shrink-0" : "flex-1",
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

        {area && <AreaTag area={area} />}
      </Link>
    </li>
  );
}

/** Area identity, toned by Condition — with a glyph so it is never color-only. */
function AreaTag({ area }: { area: NonNullable<AttentionEntry["area"]> }) {
  const ConditionIcon = conditionIcons[area.condition];
  const unwell = area.condition !== "healthy";

  return (
    <span
      title={`${area.name} — ${conditionShort[area.condition]}`}
      className="hidden shrink-0 items-center gap-1 lg:flex"
    >
      <AreaIcon
        icon={area.icon}
        className={cn(
          "size-3.5 shrink-0",
          unwell
            ? conditionTextClassName[area.condition]
            : "text-muted-foreground/60",
        )}
      />
      <span className="max-w-24 truncate text-2xs text-muted-foreground">
        {area.name}
      </span>
      {unwell && (
        <ConditionIcon
          aria-hidden
          className={cn(
            "size-3 shrink-0",
            conditionTextClassName[area.condition],
          )}
        />
      )}
      <span className="sr-only">{conditionShort[area.condition]}</span>
    </span>
  );
}

/** Nearness as weight: late shouts, this week speaks, later murmurs. */
function proximityToneClassName(delta: number | undefined) {
  if (delta === undefined) return "text-muted-foreground/40";
  if (delta < 0) return "font-medium text-condition-attention";
  if (delta <= 1) return "font-medium text-foreground";
  if (delta <= 6) return "text-foreground/70";
  return "text-muted-foreground";
}

/* -------------------------------------------------------------- the gutter */

/**
 * The scale is deliberately non-linear: the next seven days own half the
 * height, week two a quarter, weeks three and four the rest. Distance
 * compresses the way it does in the head.
 */
const SCALE_BANDS = [
  { bottom: 50, end: 7, start: 0, top: 0 },
  { bottom: 76, end: 14, start: 7, top: 50 },
  { bottom: 100, end: 28, start: 14, top: 76 },
] as const;

const LAST_BAND = SCALE_BANDS[SCALE_BANDS.length - 1] ?? SCALE_BANDS[0];

/** Where a (possibly fractional) day sits on the scale, as a percentage. */
function scalePercent(day: number) {
  const clamped = Math.min(Math.max(day, 0), LAST_BAND.end);
  const band = SCALE_BANDS.find((candidate) => clamped < candidate.end);
  const { bottom, end, start, top } = band ?? LAST_BAND;
  return top + ((clamped - start) / (end - start)) * (bottom - top);
}

const WEEK_TICKS = [7, 14, 21, 28];
const DAY_TICKS = [2, 3, 4, 5, 6];

function TimeGutter({
  currentDate,
  horizon,
  hovered,
  onHover,
}: {
  currentDate: number;
  horizon: HorizonModel;
  hovered: string | undefined;
  onHover: (id: string | undefined) => void;
}) {
  const waiting = horizon.overdue;
  const dotProps = { currentDate, hovered, onHover };

  return (
    <aside
      aria-label="The next four weeks"
      className="sticky top-16 hidden w-[88px] shrink-0 self-start lg:block"
    >
      {/* Above Today: what is already late, held as a cluster rather than
          given a place on the scale — the past has no length here. */}
      <div className="relative pb-3">
        <div className="flex justify-end pr-1">
          {waiting.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-condition-attention-fill px-1.5 py-0.5 text-2xs font-medium tabular-nums text-condition-attention-fill-foreground">
              <TriangleAlert aria-hidden className="size-3" />
              {waiting.length} waiting
            </span>
          ) : (
            <span className="text-2xs text-muted-foreground/60">
              Nothing late
            </span>
          )}
        </div>
        {waiting.length > 0 && (
          <div className="mt-1.5 flex flex-wrap justify-end gap-1 pr-[5px]">
            {waiting.slice(0, 10).map((dot) => (
              <GutterDot key={dot.id} dot={dot} {...dotProps} />
            ))}
          </div>
        )}
        <span
          aria-hidden
          className="absolute right-2 bottom-0 h-3 translate-x-1/2 border-l border-dashed border-border"
        />
      </div>

      <div className="relative h-[58vh] min-h-[400px]">
        <span
          aria-hidden
          className="absolute top-0 right-2 bottom-0 w-px bg-border"
        />

        <ScaleTick label="Today" percent={scalePercent(0)} tone="today" />
        <ScaleTick label="Tomorrow" percent={scalePercent(1)} tone="day" />
        {DAY_TICKS.map((day) => (
          <ScaleTick key={day} percent={scalePercent(day)} tone="hairline" />
        ))}
        {WEEK_TICKS.map((day) => (
          <ScaleTick
            key={day}
            label={`+${day / 7}w`}
            percent={scalePercent(day)}
            tone="week"
          />
        ))}

        {horizon.days.map((day) =>
          day.dots.length === 0 ? null : (
            <div
              key={day.date}
              style={{ top: `${scalePercent(day.dayDelta + 0.5)}%` }}
              className="absolute right-2 flex -translate-y-1/2 translate-x-[3px] flex-row-reverse items-center gap-1"
            >
              {day.dots.slice(0, 5).map((dot) => (
                <GutterDot key={dot.id} dot={dot} {...dotProps} />
              ))}
            </div>
          ),
        )}
      </div>

      <div className="pt-1.5 pr-1 text-right text-2xs tabular-nums text-muted-foreground/70">
        {horizon.beyond.length > 0
          ? `+${horizon.beyond.length} beyond`
          : "28 days"}
      </div>
    </aside>
  );
}

const tickToneClassName = {
  day: { label: "text-muted-foreground", mark: "w-3 bg-border" },
  hairline: { label: "", mark: "w-2 bg-border/70" },
  today: { label: "font-medium text-foreground", mark: "w-4 bg-foreground/50" },
  week: { label: "text-muted-foreground/70", mark: "w-3 bg-border" },
} as const;

function ScaleTick({
  label,
  percent,
  tone,
}: {
  label?: string;
  percent: number;
  tone: keyof typeof tickToneClassName;
}) {
  const { label: labelClassName, mark } = tickToneClassName[tone];

  return (
    <div
      style={{ top: `${percent}%` }}
      className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-end gap-1.5 pr-1"
    >
      {label && (
        <span className={cn("truncate text-2xs", labelClassName)}>{label}</span>
      )}
      <span aria-hidden className={cn("h-px shrink-0", mark)} />
    </div>
  );
}

/** A dated item's place in time. Threads carry their Area's tone; Tasks stay neutral. */
function GutterDot({
  currentDate,
  dot,
  hovered,
  onHover,
}: {
  currentDate: number;
  dot: HorizonDot;
  hovered: string | undefined;
  onHover: (id: string | undefined) => void;
}) {
  const active =
    hovered === dot.id || (hovered === "inbox" && dot.kind === "task");
  const when = relativeDayLabel(dot.date, currentDate);
  const condition = dot.condition;

  return (
    <span
      title={
        condition
          ? `${dot.label} · ${when} · ${conditionShort[condition]}`
          : `${dot.label} · ${when}`
      }
      onMouseEnter={() => onHover(dot.id)}
      onMouseLeave={() => onHover(undefined)}
      className={cn(
        "size-1.5 shrink-0 rounded-full transition-transform",
        dot.kind === "task"
          ? "bg-muted-foreground/40"
          : dotToneClassName(condition),
        active ? "scale-[1.8] opacity-100" : "opacity-70",
      )}
    >
      <span className="sr-only">
        {dot.label} — {when}
      </span>
    </span>
  );
}

function dotToneClassName(condition: Condition | undefined) {
  return condition
    ? conditionDotClassName[condition]
    : "bg-muted-foreground/40";
}
