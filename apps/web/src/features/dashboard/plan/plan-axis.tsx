import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";

import type {
  Axis,
  DaySlot,
  Density,
  DragState,
  SlotTotals,
} from "./plan-model";

import { bayWidth } from "./plan-model";

/**
 * Today's column, ruler and lanes alike: a tinted band with a hairline "now"
 * rule down its left edge, so the eye can find the present in one sweep.
 */
export const TODAY_COLUMN =
  "bg-surface-3/70 before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-[2px] before:bg-brand-accent-foreground/70 before:content-['']";

/** What a droppable publishes. A ruler cell keeps the drag in its own lane. */
export interface SlotDropData {
  /** Undefined on the ruler: "this day, whichever lane you came from". */
  laneId?: string;
  slotKey: string;
}

/**
 * The shared day axis: a band naming the regions over a header of one cell per
 * column, each with a bar drawn against the busiest day on screen.
 *
 * The header row is also a drop target, so a chip can be dragged straight up
 * to a date without leaving its lane.
 */
export function AxisHeader({
  areaCount,
  axis,
  density,
  drag,
  narrow,
  totals,
}: {
  areaCount: number;
  axis: Axis;
  density: Density;
  drag: DragState | null;
  /** The header column is at its compact width (see `HEADER_WIDTH_NARROW`). */
  narrow: boolean;
  totals: SlotTotals;
}) {
  return (
    <div
      className="grid w-full border-b border-border bg-surface-1"
      style={{
        gridTemplateColumns: axis.template,
        gridTemplateRows: "auto auto",
      }}
    >
      <div
        className={cn(
          "sticky left-0 z-30 flex flex-col justify-end gap-1.5 border-r border-border bg-surface-1 pt-2 pb-2",
          narrow ? "px-2.5" : "px-3.5",
        )}
        style={{ gridColumn: 1, gridRow: "1 / 3" }}
      >
        <span
          className={cn(
            "truncate font-semibold tracking-[0.06em] text-muted-foreground uppercase",
            narrow ? "text-2xs" : "text-xs",
          )}
        >
          <span className="tabular-nums">{areaCount}</span>{" "}
          {areaCount === 1 ? "Area" : "Areas"}
        </span>
        {/* Holds the bar line open so the Area label sits on the same baseline
            as every day label to its right. */}
        <span className="h-[3px]" />
      </div>

      <BandRow axis={axis} totals={totals} />

      {axis.columns.map((column, index) => {
        const gridColumn = index + 2;

        if (column.kind === "overdue") {
          return (
            <BayHeader
              key="overdue"
              count={totals.overdue}
              gridColumn={gridColumn}
              kind="overdue"
            />
          );
        }
        // The two pinned bays stack against the right edge, Later inboard of
        // No date, so both stay legible however far the axis is scrolled.
        if (column.kind === "beyond") {
          return (
            <BayHeader
              key="beyond"
              count={totals.beyond}
              gridColumn={gridColumn}
              kind="beyond"
              right={bayWidth(density)}
            />
          );
        }
        if (column.kind === "none") {
          return (
            <BayHeader
              key="none"
              count={totals.none}
              gridColumn={gridColumn}
              kind="none"
              right={0}
            />
          );
        }

        return (
          <DayHeader
            key={column.key}
            active={drag?.overSlotKey === column.key}
            count={totals.byDay.get(column.key) ?? 0}
            day={column.day}
            dragging={drag != null}
            gridColumn={gridColumn}
            isLaterStart={axis.laterFrom === index}
            peak={totals.peak}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ band -- */

/** Month spans over the near days, then the one coarse Later stretch. */
function BandRow({ axis, totals }: { axis: Axis; totals: SlotTotals }) {
  const segments = [...axis.monthSpans];

  if (axis.laterFrom != null) {
    // Stops at the last day: the two pinned bays past it are off the calendar
    // and carry their own headers.
    segments.push({
      from: axis.laterFrom,
      label: "Later",
      to: axis.columns.length - 3,
    });
  }

  // The Later stretch is the one segment worth counting: its days are ticks, so
  // their own numbers are too small to add up at a glance. Months are read off
  // the day headers underneath them.
  let later = 0;
  for (const day of axis.days) {
    if (day.region === "later") later += totals.byDay.get(day.key) ?? 0;
  }

  return (
    <>
      {segments.map((segment) => {
        const isLater = segment.label === "Later";

        return (
          <span
            key={`${segment.label}-${segment.from}`}
            className={cn(
              "flex items-baseline gap-1 px-2 pt-2 pb-1 text-2xs font-semibold tracking-[0.08em] text-muted-foreground/55 uppercase",
              segment.from > 0 && "border-l border-border/60",
            )}
            style={{
              gridColumn: `${segment.from + 2} / ${segment.to + 3}`,
              gridRow: 1,
            }}
          >
            <span className="truncate">{segment.label}</span>
            {isLater && (
              <span className="shrink-0 tracking-normal tabular-nums text-muted-foreground/45">
                {later}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------- bay cells -- */

const BAY_LABEL: Record<BayKind, string> = {
  beyond: "Later",
  none: "No date",
  overdue: "Waiting",
};

type BayKind = "beyond" | "none" | "overdue";

/**
 * The waiting bay and the two pinned bays — Later and No date: same label ·
 * count · bar stack as a day, in the tone their condition deserves — the past
 * reads as a debt, the undated and the far-off read as quiet.
 *
 * All three span the band and header rows, so their label sits on the band line
 * and their bar lands on the same baseline as the days'.
 */
function BayHeader({
  count,
  gridColumn,
  kind,
  right,
}: {
  count: number;
  gridColumn: number;
  kind: BayKind;
  /** Distance from the scroller's right edge, for the pinned bays only. */
  right?: number;
}) {
  const waiting = kind === "overdue";

  return (
    <div
      data-bay={kind}
      className={cn(
        "flex flex-col gap-1.5 px-2 pt-2 pb-2",
        right == null
          ? "border-l border-border/60"
          : "sticky z-30 border-l border-border bg-surface-1",
        waiting && "bg-condition-attention/[0.07]",
      )}
      style={{ gridColumn, gridRow: "1 / 3", right }}
    >
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "truncate text-2xs font-semibold tracking-[0.08em] uppercase",
            waiting ? "text-condition-attention" : "text-muted-foreground/70",
          )}
        >
          {BAY_LABEL[kind]}
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 text-xs tabular-nums",
            waiting
              ? "text-condition-attention/80"
              : "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      </div>

      <div className="mt-auto h-[3px] w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            "h-full rounded-full",
            waiting ? "bg-condition-attention/70" : "bg-foreground/12",
          )}
          style={{ width: count > 0 ? "100%" : 0 }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ day headers -- */

function DayHeader({
  active,
  count,
  day,
  dragging,
  gridColumn,
  isLaterStart,
  peak,
}: {
  active: boolean;
  count: number;
  day: DaySlot;
  dragging: boolean;
  gridColumn: number;
  isLaterStart: boolean;
  peak: number;
}) {
  const { setNodeRef } = useDroppable({
    id: `ruler::${day.key}`,
    data: { slotKey: day.key } satisfies SlotDropData,
  });

  const date = new Date(day.at);

  return (
    <div
      ref={setNodeRef}
      data-day={day.key}
      style={{ gridColumn, gridRow: 2 }}
      className={cn(
        "relative flex flex-col justify-end gap-1.5 pt-2 pb-2 transition-colors",
        day.wide ? "px-2" : "px-1",
        isLaterStart
          ? "border-l border-border/60"
          : day.isWeekStart
            ? "border-l border-border/45"
            : "border-l border-border/25",
        day.isWeekend && "bg-foreground/[0.03]",
        day.isToday && TODAY_COLUMN,
        dragging && "cursor-copy",
        active && "bg-brand-gold-strong/15",
      )}
    >
      {day.isToday && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-[2px] bg-brand-accent-foreground"
        />
      )}

      {day.wide ? (
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "truncate text-2xs font-semibold tracking-[0.06em] uppercase",
              dayLabelTone(day, active),
            )}
          >
            {day.isToday ? "Today" : format(date, "EEE")}
          </span>
          <span
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              dayNumberTone(day, active),
            )}
          >
            {day.isMonthStart ? format(date, "d MMM") : format(date, "d")}
          </span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground/70">
            {count}
          </span>
        </div>
      ) : (
        <>
          {/* The month stamp is the Later region's only signpost. It floats in
              the padding so a month edge never grows the header row. */}
          {day.isMonthStart && (
            <span className="pointer-events-none absolute inset-x-0 top-1 truncate text-center text-2xs leading-none font-semibold text-muted-foreground/45 uppercase">
              {format(date, "MMM")}
            </span>
          )}
          <span
            className={cn(
              "text-center text-xs leading-4 font-semibold tabular-nums",
              tickNumberTone(day, active),
            )}
          >
            {format(date, "d")}
          </span>
        </>
      )}

      {/* The bar track runs at every column width, ticks included: one
          continuous rail under the axis, filled where work sits. */}
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            "h-full rounded-full transition-colors",
            active
              ? "bg-foreground/45"
              : day.isToday
                ? "bg-brand-accent-foreground"
                : "bg-foreground/22",
          )}
          style={{
            width: active ? "100%" : `${Math.min(1, count / peak) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- tones -- */

function dayLabelTone(day: DaySlot, active: boolean): string {
  if (day.isToday) return "text-brand-accent-foreground";
  if (active) return "text-foreground";
  return day.isWeekend ? "text-muted-foreground/55" : "text-muted-foreground";
}

function dayNumberTone(day: DaySlot, active: boolean): string {
  if (day.isToday || active) return "text-foreground";
  return day.isWeekend ? "text-muted-foreground/60" : "text-foreground/70";
}

function tickNumberTone(day: DaySlot, active: boolean): string {
  if (active) return "text-foreground";
  return day.isWeekend
    ? "text-muted-foreground/35"
    : "text-muted-foreground/50";
}
