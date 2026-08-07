import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";

import type { Axis, DaySlot, DragState } from "./model";

import { HEADER_WIDTH } from "./model";

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
 * The shared day ruler.
 *
 * One continuous axis: a waiting bay for the past, then every day from today
 * to the horizon, then the pinned No-date bay. Days nobody planned into shrink
 * to a tick, so the ruler stays short without ever giving up day resolution —
 * and the ruler itself is a drop target, so a chip can be dragged straight up
 * to a date without leaving its lane.
 */
export function AxisHeader({
  areaCount,
  axis,
  drag,
}: {
  areaCount: number;
  axis: Axis;
  drag: DragState | null;
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
        className="sticky left-0 z-30 flex flex-col justify-end border-r border-border bg-surface-1 px-3.5 pt-1.5 pb-1.5"
        style={{ gridColumn: 1, gridRow: "1 / 3" }}
      >
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          <span className="tabular-nums">{areaCount}</span>{" "}
          {areaCount === 1 ? "Area" : "Areas"}
        </span>
      </div>

      <BandRow axis={axis} />

      {axis.columns.map((column, index) => {
        const gridColumn = index + 2;

        if (column.kind === "overdue") {
          return <BayRulerCell key="overdue" gridColumn={gridColumn} waiting />;
        }
        if (column.kind === "none") {
          return <BayRulerCell key="none" gridColumn={gridColumn} pinned />;
        }

        return (
          <RulerDay
            key={column.key}
            active={drag?.overSlotKey === column.key}
            day={column.day}
            dragging={drag != null}
            gridColumn={gridColumn}
            isLaterStart={axis.laterFrom === index}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ band -- */

function BandRow({ axis }: { axis: Axis }) {
  const segments: { from: number; label: string; to: number }[] = [];

  if (axis.hasOverdue) segments.push({ from: 0, label: "Waiting", to: 0 });
  segments.push(...axis.monthSpans);
  if (axis.laterFrom != null) {
    segments.push({
      from: axis.laterFrom,
      label: "Later",
      to: axis.columns.length - 2,
    });
  }
  segments.push({
    from: axis.columns.length - 1,
    label: "No date",
    to: axis.columns.length - 1,
  });

  return (
    <>
      {segments.map((segment) => (
        <span
          key={`${segment.label}-${segment.from}`}
          className={cn(
            "truncate px-2 pt-1.5 pb-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase",
            segment.label === "Waiting"
              ? "text-condition-attention/80"
              : "text-muted-foreground/55",
            segment.from > 0 && "border-l border-border/60",
          )}
          style={{
            gridColumn: `${segment.from + 2} / ${segment.to + 3}`,
            gridRow: 1,
          }}
        >
          {segment.label}
        </span>
      ))}
    </>
  );
}

/* -------------------------------------------------------------- bay cells -- */

/** The band above already names these two bays; the ruler stays silent. */
function BayRulerCell({
  gridColumn,
  pinned,
  waiting,
}: {
  gridColumn: number;
  pinned?: boolean;
  waiting?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        pinned
          ? "sticky right-0 z-30 border-l border-border bg-surface-1"
          : "border-l border-border/60",
        waiting && "bg-condition-attention/[0.07]",
      )}
      style={{ gridColumn, gridRow: 2 }}
    />
  );
}

/* -------------------------------------------------------------- day ticks -- */

function RulerDay({
  active,
  day,
  dragging,
  gridColumn,
  isLaterStart,
}: {
  active: boolean;
  day: DaySlot;
  dragging: boolean;
  gridColumn: number;
  isLaterStart: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `ruler::${day.key}`,
    data: { slotKey: day.key } satisfies SlotDropData,
  });

  const monthStamp =
    day.region === "later" && day.isMonthStart
      ? format(new Date(day.at), "MMM")
      : undefined;

  return (
    <div
      ref={setNodeRef}
      data-day={day.key}
      style={{ gridColumn, gridRow: 2 }}
      className={cn(
        "relative flex flex-col items-center justify-end gap-px pt-1 pb-1.5 transition-colors",
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
      <span
        className={cn(
          "text-[8px] leading-none font-semibold tracking-tight uppercase",
          day.isToday
            ? "text-brand-accent-foreground"
            : active
              ? "text-foreground"
              : day.isWeekend
                ? "text-muted-foreground/40"
                : "text-muted-foreground/60",
        )}
      >
        {monthStamp ?? format(new Date(day.at), "EEEEE")}
      </span>
      <span
        className={cn(
          "text-[11px] leading-none tabular-nums",
          day.isToday
            ? "font-bold text-brand-accent-foreground"
            : active
              ? "font-semibold text-foreground"
              : day.occupied
                ? "font-medium text-foreground/75"
                : "text-muted-foreground/45",
        )}
      >
        {format(new Date(day.at), "d")}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 h-[3px] w-full rounded-full transition-colors",
          day.isToday
            ? "bg-brand-accent-foreground"
            : active
              ? "bg-foreground/45"
              : "bg-transparent",
        )}
      />
    </div>
  );
}

export { HEADER_WIDTH };
