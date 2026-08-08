// PROTOTYPE — throwaway (issue #268). Variant B4: month grid — collapsible mini-month navigator over a day-anchored agenda.

import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import type { ReactNode } from "react";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  Inbox,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import type { PlanItem } from "@/features/dashboard/plan/plan-model";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { AreaFilterChips } from "@/features/dashboard/plan/plan-filters";
import {
  buildPlanItems,
  conditionIconTone,
  conditionRailTone,
  dayAt,
  dayCaption,
  dayDelta,
  dayKey,
  NEAR_DAYS,
  waitingLabel,
} from "@/features/dashboard/plan/plan-model";

/**
 * Plan — month grid over an agenda (phone).
 *
 * Variant B2 wears Google Calendar's Schedule view; this one wears Apple
 * Calendar / Fantastical: a **mini month pinned at the top** and the same
 * day-anchored agenda underneath it. The month is a *navigator*, not a
 * container — it never shows titles, only presence: up to three condition-tinted
 * dots per day, today in a filled accent disc, the selected day ringed.
 *
 * Two things the agenda alone cannot do:
 *
 * - **Jump.** Tapping a day scrolls the agenda to it, opening the quiet run it
 *   was folded into. Reaching 6 September no longer costs a screenful of thumb.
 * - **Throw.** Every cell is a drop target, so a chip can be rescheduled three
 *   weeks out without the agenda ever scrolling under the drag.
 *
 * It starts **collapsed to a single week row** — the agenda is the point, the
 * grid is the map — and a grab handle opens it to the full month. A drag in
 * flight opens it automatically so the far targets exist while the finger is
 * down. Drops write to a local `moves` map, never to Convex.
 */
export function PlanVariantMonthGrid({
  areas,
  currentDate,
  tasks,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  tasks: DashboardInboxTask[];
  threads: DashboardThread[];
}) {
  const now = currentDate;
  const navigate = useNavigate();

  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );
  /** itemId → day key (`d3`) or `"none"`. Prototype-local; no mutation runs. */
  const [moves, setMoves] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [drag, setDrag] = useState<GridDrag | null>(null);
  const [openGaps, setOpenGaps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [showNoDate, setShowNoDate] = useState(false);
  const [todayInView, setTodayInView] = useState(true);

  /** The grid is a navigator, so it opens folded to the selected week. */
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(() => dayAt(0, now));
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(new Date(now)).getTime(),
  );
  const [pendingScroll, setPendingScroll] = useState<number | null>(null);

  const rootRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const dayNodes = useRef(new Map<string, HTMLDivElement>());
  const [todayNode, setTodayNode] = useState<HTMLDivElement | null>(null);

  /** Same guards as the canvas: 5px for mouse, long-press for touch. */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  const areaById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas],
  );

  const items = useMemo(() => buildPlanItems(threads, tasks), [threads, tasks]);

  /** Local drops re-date the item before anything else looks at it. */
  const moved = useMemo(
    () =>
      items.map((item) => {
        const target = moves.get(item.id);
        if (target == null) return item;
        if (target === "none") return { ...item, date: undefined };
        return { ...item, date: dayAt(Number(target.slice(1)), now) };
      }),
    [items, moves, now],
  );

  /** Tasks have no Area, so the Area filter never hides them. */
  const visible = useMemo(
    () =>
      moved.filter(
        (item) =>
          item.kind === "task" ||
          activeAreas == null ||
          (item.areaId != null && activeAreas.has(item.areaId)),
      ),
    [moved, activeAreas],
  );

  /* -------------------------------------------------------------- month -- */

  const weeks = useMemo(
    () => buildMonthWeeks(viewMonth, now, visible, areaById),
    [viewMonth, now, visible, areaById],
  );

  /** Collapsed, the grid shows the selected week — or the month's first. */
  const selectedWeek = useMemo(
    () =>
      weeks.find((week) => week.some((cell) => cell.at === selected)) ??
      weeks[0],
    [weeks, selected],
  );

  // A drag needs targets, so the month opens itself while one is in flight.
  const gridOpen = expanded || drag != null;
  const shownWeeks = gridOpen ? weeks : [selectedWeek];
  const monthTitle = format(
    new Date(gridOpen ? viewMonth : selectedWeek[3].at),
    "MMMM yyyy",
  );

  /**
   * The agenda always reaches at least as far as the grid shows, so a day
   * tapped in a future month has a row to scroll to.
   */
  const reach = useMemo(() => {
    const last = weeks.at(-1)?.at(-1);
    return last ? dayDelta(last.at, now) : 0;
  }, [weeks, now]);

  const schedule = useMemo(
    () => buildSchedule(visible, now, reach),
    [visible, now, reach],
  );

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of moved) {
      if (item.areaId == null) continue;
      counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
    }
    return counts;
  }, [moved]);

  /* ------------------------------------------------------------ scroll -- */

  const registerDay = useCallback(
    (key: string, node: HTMLDivElement | null) => {
      if (node) dayNodes.current.set(key, node);
      else dayNodes.current.delete(key);
      if (key === "d0") setTodayNode(node);
    },
    [],
  );

  /**
   * Land the day under the pinned header rather than under the app bar — the
   * header's height changes with the grid, so it is measured at call time.
   */
  const scrollToOffset = useCallback((offset: number, smooth: boolean) => {
    const inset = APP_BAR + (headerRef.current?.offsetHeight ?? 0) + 8;
    const behavior = smooth ? ("smooth" as const) : ("auto" as const);

    if (offset < 0) {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      window.scrollTo({ behavior, top: top + window.scrollY - APP_BAR });
      return;
    }

    // Past the horizon (or inside a run still folded) there is no row: fall
    // back to the nearest earlier day that did render.
    let node: HTMLDivElement | undefined;
    for (let probe = offset; probe >= 0 && !node; probe -= 1) {
      node = dayNodes.current.get(dayKey(probe));
    }
    if (!node) return;
    window.scrollTo({
      behavior,
      top: node.getBoundingClientRect().top + window.scrollY - inset,
    });
  }, []);

  /** Open on today, the way a calendar app does. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToOffset(0, false));
    return () => cancelAnimationFrame(frame);
  }, [scrollToOffset]);

  /** Selection scrolls on the frame after the gap it may have opened. */
  useEffect(() => {
    if (pendingScroll == null) return;
    const frame = requestAnimationFrame(() => {
      scrollToOffset(pendingScroll, true);
      setPendingScroll(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingScroll, scrollToOffset]);

  useEffect(() => {
    if (!todayNode) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTodayInView(entry.isIntersecting),
      { rootMargin: `-${APP_BAR + 120}px 0px -25% 0px` },
    );
    observer.observe(todayNode);
    return () => observer.disconnect();
  }, [todayNode]);

  /* ---------------------------------------------------------- selection -- */

  function selectDay(at: number) {
    const offset = dayDelta(at, now);
    setSelected(at);
    setViewMonth(startOfMonth(new Date(at)).getTime());

    // A day folded into a quiet run has no row yet — unfold it first.
    const gap = schedule.rows.find(
      (row): row is Extract<ScheduleRow, { kind: "gap" }> =>
        row.kind === "gap" && offset >= row.from && offset <= row.to,
    );
    if (gap) {
      setOpenGaps((previous) => new Set(previous).add(gap.from));
    }
    setPendingScroll(offset);
  }

  function jumpToToday() {
    const at = dayAt(0, now);
    setSelected(at);
    setViewMonth(startOfMonth(new Date(now)).getTime());
    setPendingScroll(0);
  }

  /* ------------------------------------------------------------- open -- */

  function openItem(item: PlanItem) {
    if (item.kind === "task") {
      void navigate({ to: "/inbox" });
      return;
    }
    if (item.slug == null) return;
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, thread: item.slug }),
    });
  }

  /* ------------------------------------------------------------- drag -- */

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ChipDrag | undefined;
    if (!data) return;
    setDrag({ itemId: data.itemId, slotKey: data.slotKey });
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.data.current as SlotDrop | undefined;
    setDrag((previous) =>
      previous ? { ...previous, overSlotKey: over?.slotKey } : previous,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDrag(null);

    const source = event.active.data.current as ChipDrag | undefined;
    const over = event.over?.data.current as SlotDrop | undefined;
    if (!source || !over) return;
    // The past is not a target — the same rule the canvas enforces, and the
    // rule every past month cell borrows by reporting the `overdue` slot.
    if (over.slotKey === "overdue") return;
    if (over.slotKey === source.slotKey) return;

    if (over.slotKey === "none") setShowNoDate(true);
    else {
      // A cell drop is also a navigation: follow the chip to where it landed.
      const offset = Number(over.slotKey.slice(1));
      setSelected(dayAt(offset, now));
    }
    setMoves((previous) => {
      const next = new Map(previous);
      next.set(source.itemId, over.slotKey);
      return next;
    });
  }

  function toggleGap(from: number) {
    setOpenGaps((previous) => {
      const next = new Set(previous);
      if (next.has(from)) next.delete(from);
      else next.add(from);
      return next;
    });
  }

  const dragging = drag && visible.find((item) => item.id === drag.itemId);
  const caption = drag?.overSlotKey ? dropCaption(drag.overSlotKey, now) : null;

  const chrome: GridChrome = {
    areaById,
    drag,
    now,
    onOpen: openItem,
    register: registerDay,
    selectedKey: dayKey(dayDelta(selected, now)),
  };

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col" ref={rootRef}>
      <DndContext
        collisionDetection={pointerWithin}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDrag(null)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Drag onto a day — in the month grid above or the agenda below — to reschedule, or onto No date to clear it. Press Enter to open it instead.",
          },
        }}
      >
        {/* The pinned navigator: filters, month, week rows, grab handle. */}
        <div
          ref={headerRef}
          className="sticky top-12 z-20 -mx-1 bg-surface-1/95 px-1 pt-1 backdrop-blur-sm"
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none]">
            <div className="w-max">
              <AreaFilterChips
                active={activeAreas}
                areas={areas}
                counts={areaCounts}
                onChange={setActiveAreas}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 pb-1">
            <span className="font-heading text-[13px] font-semibold tracking-tight">
              {monthTitle}
            </span>
            <span aria-hidden className="h-px flex-1 bg-border/50" />
            <MonthStep
              label="Previous month"
              onClick={() =>
                setViewMonth(addMonths(new Date(viewMonth), -1).getTime())
              }
            >
              <ChevronLeft className="size-4" />
            </MonthStep>
            <MonthStep
              label="Next month"
              onClick={() =>
                setViewMonth(addMonths(new Date(viewMonth), 1).getTime())
              }
            >
              <ChevronRight className="size-4" />
            </MonthStep>
          </div>

          <div className="grid grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <span
                key={weekday.key}
                className="text-center text-[9px] font-semibold tracking-[0.08em] text-muted-foreground/45 uppercase"
              >
                {weekday.label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {shownWeeks.flat().map((cell) => (
              <MonthDayCell
                key={cell.key}
                cell={cell}
                dragging={drag != null}
                onSelect={selectDay}
                selected={cell.at === selected}
              />
            ))}
          </div>

          <button
            type="button"
            aria-expanded={gridOpen}
            aria-label={gridOpen ? "Collapse month" : "Expand month"}
            onClick={() => setExpanded((previous) => !previous)}
            className="flex w-full items-center justify-center gap-1 pt-1 pb-1.5"
          >
            <span
              aria-hidden
              className="h-[3px] w-9 rounded-full bg-border transition-colors"
            />
            {gridOpen ? (
              <ChevronUp className="size-3 text-muted-foreground/50" />
            ) : (
              <ChevronDown className="size-3 text-muted-foreground/50" />
            )}
          </button>

          <span aria-hidden className="block h-px bg-border/60" />
        </div>

        <div className="flex flex-col">
          {schedule.overdue.length > 0 && (
            <OverdueSection chrome={chrome} items={schedule.overdue} />
          )}

          {schedule.rows.map((row) => {
            if (row.kind === "month") {
              return <MonthBand key={row.key} label={row.label} />;
            }
            if (row.kind === "gap") {
              return (
                <GapRow
                  key={row.key}
                  chrome={chrome}
                  from={row.from}
                  open={openGaps.has(row.from)}
                  onToggle={() => toggleGap(row.from)}
                  to={row.to}
                />
              );
            }
            return (
              <DayRow
                key={row.key}
                chrome={chrome}
                items={schedule.byDay.get(row.key)}
                offset={row.offset}
              />
            );
          })}

          <NoDateSection
            chrome={chrome}
            items={schedule.none}
            open={showNoDate}
            onToggle={() => setShowNoDate((previous) => !previous)}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && drag && (
            <div className="w-[17rem] max-w-[80vw] cursor-grabbing">
              <ChipSurface
                areaById={areaById}
                item={dragging}
                lifted
                now={now}
                slotKey={drag.slotKey}
              />
              {caption && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                    caption.blocked
                      ? "bg-surface-2 text-muted-foreground/70 ring-1 ring-border/60"
                      : "bg-foreground text-surface-1",
                  )}
                >
                  {caption.blocked ? (
                    <Ban className="size-2.5 shrink-0" />
                  ) : (
                    <CornerDownRight className="size-2.5 shrink-0" />
                  )}
                  {caption.text}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Bottom-right: the mobile tab bar owns the bottom edge and the DEV
          toolbar owns bottom-centre, so the pill floats clear of both. */}
      {!todayInView && (
        <button
          type="button"
          onClick={jumpToToday}
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 font-heading text-[11px] font-semibold tracking-tight text-surface-1 shadow-lg"
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-brand-gold-strong"
          />
          Today
        </button>
      )}

      {schedule.total === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center font-heading text-sm font-semibold">
          Nothing to plan
        </p>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- shapes -- */

interface GridDrag {
  itemId: string;
  overSlotKey?: string;
  slotKey: string;
}

interface ChipDrag {
  itemId: string;
  slotKey: string;
}

interface SlotDrop {
  slotKey: string;
}

interface GridChrome {
  areaById: ReadonlyMap<string, DashboardArea>;
  drag: GridDrag | null;
  now: number;
  onOpen: (item: PlanItem) => void;
  register: (key: string, node: HTMLDivElement | null) => void;
  /** The agenda row the month grid is currently pointing at. */
  selectedKey: string;
}

type ScheduleRow =
  | { from: number; key: string; kind: "gap"; to: number }
  | { key: string; kind: "day"; offset: number }
  | { key: string; kind: "month"; label: string };

/** The agenda always reaches this far so there is somewhere to plan into. */
const MIN_HORIZON = 27;
/** Higher than B2's 90: the grid can page months out, and gaps stay folded. */
const MAX_HORIZON = 180;

/** The sticky app bar. The pinned navigator's height is measured, not assumed. */
const APP_BAR = 48;

/** The date rail. Wide enough for "WED" over a two-digit day at 15px. */
const RAIL = "w-12 shrink-0";

const WEEKDAYS = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

/* ----------------------------------------------------------- month grid -- */

interface MonthCell {
  at: number;
  /** Tone class per dot, worst condition first, three at most. */
  dots: string[];
  inMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  key: string;
  offset: number;
}

const NO_DOTS: string[] = [];

/** Presence only — the grid never carries a title, so severity is the colour. */
const DOT_TONES = [
  "bg-condition-critical",
  "bg-condition-attention",
  "bg-brand-accent-foreground/55",
  "bg-muted-foreground/35",
];

/** Weeks of the viewed month, Monday first, padded out to whole weeks. */
function buildMonthWeeks(
  view: number,
  now: number,
  items: PlanItem[],
  areaById: ReadonlyMap<string, DashboardArea>,
): MonthCell[][] {
  const ranks = new Map<number, number[]>();
  for (const item of items) {
    if (item.date == null) continue;
    const offset = dayDelta(item.date, now);
    const area = item.areaId == null ? undefined : areaById.get(item.areaId);
    const rank =
      item.kind === "task"
        ? 3
        : area?.condition === "critical"
          ? 0
          : area?.condition === "needs_attention"
            ? 1
            : 2;
    const bucket = ranks.get(offset);
    if (bucket) bucket.push(rank);
    else ranks.set(offset, [rank]);
  }

  const month = new Date(view).getMonth();
  const last = endOfWeek(endOfMonth(new Date(view)), {
    weekStartsOn: 1,
  }).getTime();
  const cursor = startOfWeek(startOfMonth(new Date(view)), { weekStartsOn: 1 });

  const weeks: MonthCell[][] = [];
  let week: MonthCell[] = [];

  while (cursor.getTime() <= last) {
    const at = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
    ).getTime();
    const offset = dayDelta(at, now);
    const bucket = ranks.get(offset);

    week.push({
      at,
      dots: bucket
        ? [...bucket]
            .sort((a, b) => a - b)
            .slice(0, 3)
            .map((rank) => DOT_TONES[rank])
        : NO_DOTS,
      inMonth: cursor.getMonth() === month,
      isPast: offset < 0,
      isToday: offset === 0,
      key: `c${at}`,
      offset,
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return weeks;
}

function MonthStep({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-full text-muted-foreground/70 transition-colors active:bg-surface-3"
    >
      {children}
    </button>
  );
}

/**
 * One month cell: a drop target that happens to be tappable.
 *
 * A past cell reports the `overdue` slot, so it rejects the drop and prints the
 * same blocked caption the waiting bay does — one rule, two places.
 */
function MonthDayCell({
  cell,
  dragging,
  onSelect,
  selected,
}: {
  cell: MonthCell;
  dragging: boolean;
  onSelect: (at: number) => void;
  selected: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell::${cell.key}`,
    data: {
      slotKey: cell.isPast ? "overdue" : dayKey(cell.offset),
    } satisfies SlotDrop,
  });
  const armed = dragging && isOver;

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(cell.at)}
      className={cn(
        "flex h-11 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg transition-colors",
        // Out of month is quiet; the past is quieter still, and a past day of
        // an adjacent month is the quietest thing on the grid.
        cell.isPast
          ? cell.inMonth
            ? "opacity-40"
            : "opacity-25"
          : cell.inMonth
            ? undefined
            : "opacity-50",
        armed &&
          (cell.isPast
            ? "bg-condition-attention/10 ring-1 ring-condition-attention/30 ring-inset"
            : "bg-brand-gold-strong/20 ring-1 ring-foreground/25 ring-inset"),
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-[12px] leading-none font-semibold tabular-nums",
          cell.isToday
            ? "bg-brand-accent-foreground text-surface-1"
            : "text-foreground/80",
          selected &&
            (cell.isToday
              ? "ring-2 ring-brand-accent-foreground/35 ring-offset-1 ring-offset-surface-1"
              : "text-foreground ring-1 ring-foreground/55"),
        )}
      >
        {format(new Date(cell.at), "d")}
      </span>

      <span aria-hidden className="flex h-1 items-center gap-[3px]">
        {cell.dots.map((tone, index) => (
          <span
            key={`${cell.key}-${String(index)}`}
            className={cn("size-1 rounded-full", tone)}
          />
        ))}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------- grouping -- */

interface Schedule {
  byDay: Map<string, PlanItem[]>;
  none: PlanItem[];
  overdue: PlanItem[];
  rows: ScheduleRow[];
  total: number;
}

/**
 * One pass from `PlanItem[]` to the rows the agenda renders. B2's builder, plus
 * a `reach` floor so the agenda always covers what the month grid can show.
 */
function buildSchedule(items: PlanItem[], now: number, reach = 0): Schedule {
  const byDay = new Map<string, PlanItem[]>();
  const none: PlanItem[] = [];
  const overdue: PlanItem[] = [];
  let furthest = 0;

  for (const item of items) {
    if (item.date == null) {
      none.push(item);
      continue;
    }
    const offset = dayDelta(item.date, now);
    if (offset < 0) {
      overdue.push(item);
      continue;
    }
    if (offset > furthest) furthest = offset;
  }

  const horizon = Math.min(MAX_HORIZON, Math.max(MIN_HORIZON, furthest, reach));

  for (const item of items) {
    if (item.date == null) continue;
    const offset = dayDelta(item.date, now);
    if (offset < 0) continue;
    const key = dayKey(Math.min(offset, horizon));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }

  for (const bucket of byDay.values()) bucket.sort(byDateThenTitle);
  overdue.sort(byDateThenTitle);
  none.sort(byDateThenTitle);

  const rows: ScheduleRow[] = [];
  let month = "";

  /** A band whenever the list crosses into a new month, the first included. */
  function pushMonth(at: number) {
    const label = monthLabel(at);
    if (label === month) return;
    month = label;
    rows.push({ key: `m${label}`, kind: "month", label });
  }

  let gapFrom: number | null = null;
  function flushGap(to: number) {
    if (gapFrom == null) return;
    pushMonth(dayAt(gapFrom, now));
    rows.push({ from: gapFrom, key: `g${gapFrom}`, kind: "gap", to });
    gapFrom = null;
  }

  for (let offset = 0; offset <= horizon; offset += 1) {
    const occupied = (byDay.get(dayKey(offset))?.length ?? 0) > 0;
    // Today is inside the near horizon, so the present never collapses.
    if (!occupied && offset >= NEAR_DAYS) {
      if (gapFrom == null) gapFrom = offset;
      continue;
    }
    flushGap(offset - 1);
    pushMonth(dayAt(offset, now));
    rows.push({ key: dayKey(offset), kind: "day", offset });
  }
  flushGap(horizon);

  return { byDay, none, overdue, rows, total: items.length };
}

function monthLabel(at: number): string {
  return format(new Date(at), "MMMM yyyy");
}

function byDateThenTitle(a: PlanItem, b: PlanItem): number {
  const left = a.date ?? 0;
  const right = b.date ?? 0;
  if (left !== right) return left - right;
  return a.title.localeCompare(b.title);
}

function dropCaption(
  slotKey: string,
  now: number,
): { blocked: boolean; text: string } {
  if (slotKey === "overdue") {
    return { blocked: true, text: "Can't plan into the past" };
  }
  if (slotKey === "none") return { blocked: false, text: "No date" };
  return {
    blocked: false,
    text: dayCaption(dayAt(Number(slotKey.slice(1)), now)),
  };
}

/* ------------------------------------------------------------ furniture -- */

/**
 * Non-sticky here, unlike B2: the month grid already owns the pinned band under
 * the app bar, and two things fighting for `top-12` is one thing too many.
 */
function MonthBand({ label }: { label: string }) {
  return (
    <div className="-mx-1 flex items-center gap-2 px-1 pt-3 pb-1.5">
      <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/**
 * Weekday over day number in a fixed 48px column, today's number in a filled
 * accent disc — the same date marker the month cells use, at agenda scale.
 */
function DayRail({
  compact,
  date,
  isToday,
  isWeekend,
}: {
  compact?: boolean;
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
}) {
  if (compact) {
    return (
      <div
        className={cn(
          RAIL,
          "flex items-baseline justify-center gap-1 pt-1 text-[10px] leading-none",
        )}
      >
        <span
          className={cn(
            "font-medium tracking-[0.06em] uppercase",
            isWeekend ? "text-muted-foreground/35" : "text-muted-foreground/50",
          )}
        >
          {format(date, "EEE")}
        </span>
        <span
          className={cn(
            "tabular-nums",
            isWeekend ? "text-muted-foreground/35" : "text-muted-foreground/50",
          )}
        >
          {format(date, "d")}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(RAIL, "flex flex-col items-center gap-1 pt-2")}>
      <span
        className={cn(
          "text-[9px] leading-none font-semibold tracking-[0.1em] uppercase",
          isToday
            ? "text-brand-accent-foreground"
            : isWeekend
              ? "text-muted-foreground/45"
              : "text-muted-foreground/70",
        )}
      >
        {format(date, "EEE")}
      </span>
      {isToday ? (
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-accent-foreground text-[14px] leading-none font-semibold tabular-nums text-surface-1">
          {format(date, "d")}
        </span>
      ) : (
        <span
          className={cn(
            "flex size-7 items-center justify-center text-[15px] leading-none font-semibold tabular-nums",
            isWeekend ? "text-muted-foreground/55" : "text-foreground/75",
          )}
        >
          {format(date, "d")}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ rows -- */

const EMPTY: PlanItem[] = [];

/**
 * One calendar day: rail on the left, chips stacked to its right. An empty day
 * keeps the row and loses only the chips, so it stays a droppable place.
 *
 * The row registers its node so the grid above can scroll to it, and wears a
 * soft outline while it is the day the grid points at.
 */
function DayRow({
  chrome,
  items = EMPTY,
  offset,
}: {
  chrome: GridChrome;
  items?: PlanItem[];
  offset: number;
}) {
  const key = dayKey(offset);
  const date = new Date(dayAt(offset, chrome.now));
  const isToday = offset === 0;
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const empty = items.length === 0;
  const isSelected = chrome.selectedKey === key;

  const { isOver, setNodeRef } = useDroppable({
    id: `slot::${key}`,
    data: { slotKey: key } satisfies SlotDrop,
  });
  const armed = chrome.drag != null && isOver;

  const { register } = chrome;
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      register(key, node);
    },
    [key, register, setNodeRef],
  );

  return (
    <div
      ref={attach}
      className={cn(
        "relative flex items-stretch rounded-md transition-colors",
        isToday && "bg-brand-accent-foreground/[0.05]",
        isSelected && !isToday && "bg-surface-3/40",
        armed && "bg-brand-gold-strong/15",
      )}
    >
      {isToday && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] rounded-full bg-brand-accent-foreground/70"
        />
      )}
      {isSelected && !isToday && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] rounded-full bg-foreground/25"
        />
      )}

      {/* Today keeps the full rail however empty the filters leave it — the
          present never shrinks to a hairline date. */}
      <DayRail
        compact={empty && !isToday}
        date={date}
        isToday={isToday}
        isWeekend={isWeekend}
      />

      <div
        className={cn(
          "min-w-0 flex-1 border-t pr-0.5 pl-1",
          armed
            ? "border-dashed border-foreground/40"
            : isToday
              ? "border-brand-accent-foreground/25"
              : "border-border/45",
          empty ? "h-6" : "flex flex-col gap-1 py-1.5",
        )}
      >
        {items.map((item) => (
          <PlanChip key={item.id} chrome={chrome} item={item} slotKey={key} />
        ))}
      </div>
    </div>
  );
}

/**
 * A run of quiet days as one line. Tapping it — or tapping a day inside it in
 * the month grid — opens the run into the same hairline rows the near horizon
 * prints.
 */
function GapRow({
  chrome,
  from,
  onToggle,
  open,
  to,
}: {
  chrome: GridChrome;
  from: number;
  onToggle: () => void;
  open: boolean;
  to: number;
}) {
  const count = to - from + 1;
  const offsets: number[] = [];
  for (let offset = from; offset <= to; offset += 1) offsets.push(offset);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex items-center border-t border-dashed border-border/50 py-1.5 text-left"
      >
        <span
          aria-hidden
          className={cn(
            RAIL,
            "text-center text-[10px] text-muted-foreground/35",
          )}
        >
          ···
        </span>
        <span className="flex flex-1 items-center gap-1 pl-1 text-[10px] text-muted-foreground/55">
          <span className="tabular-nums">{count}</span>
          {count === 1 ? "quiet day" : "quiet days"}
          {open ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </span>
      </button>

      {open &&
        offsets.map((offset) => {
          const at = dayAt(offset, chrome.now);
          const crossesMonth = new Date(at).getDate() === 1;
          return (
            <div key={dayKey(offset)} className="flex flex-col">
              {crossesMonth && <MonthBand label={monthLabel(at)} />}
              <DayRow chrome={chrome} offset={offset} />
            </div>
          );
        })}
    </div>
  );
}

/** Above the months: the debt, not a plan. Never accepts a drop. */
function OverdueSection({
  chrome,
  items,
}: {
  chrome: GridChrome;
  items: PlanItem[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "slot::overdue",
    data: { slotKey: "overdue" } satisfies SlotDrop,
  });
  const rejecting = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-2 mb-1 rounded-xl bg-condition-attention/[0.07] transition-colors",
        rejecting && "ring-1 ring-condition-attention/30 ring-inset",
      )}
    >
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1.5">
        <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-condition-attention uppercase">
          Waiting
        </span>
        <span aria-hidden className="h-px flex-1 bg-condition-attention/20" />
        <span className="text-[10px] tabular-nums text-condition-attention">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-1.5 pb-2">
        {items.map((item) => (
          <PlanChip
            key={item.id}
            chrome={chrome}
            item={item}
            slotKey="overdue"
          />
        ))}
      </div>
    </div>
  );
}

/** The bottom of the list, folded away behind its count until asked for. */
function NoDateSection({
  chrome,
  items,
  onToggle,
  open,
}: {
  chrome: GridChrome;
  items: PlanItem[];
  onToggle: () => void;
  open: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "slot::none",
    data: { slotKey: "none" } satisfies SlotDrop,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-2 rounded-xl border border-border/70 transition-colors",
        armed && "border-transparent bg-brand-gold-strong/15",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
          No date
        </span>
        <span className="rounded-full bg-surface-3 px-1.5 text-[10px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/40" />
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground/60" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground/60" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-1 px-1.5 pb-2">
          {items.length === 0 ? (
            <p className="py-1 pl-1 text-[11px] text-muted-foreground/40">
              Everything has a day
            </p>
          ) : (
            items.map((item) => (
              <PlanChip
                key={item.id}
                chrome={chrome}
                item={item}
                slotKey="none"
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- chip -- */

/**
 * Presentation only, so the lifted ghost is identical to the row it left.
 *
 * The chip *is* the Area label: a condition rail down its left edge and the
 * Area's icon in a condition-toned pill — the same three conditions the month
 * grid spends its dots on. An inbox Task wears a dashed pill and the Inbox
 * glyph instead; it has no Area to wear.
 */
function ChipSurface({
  areaById,
  item,
  lifted,
  now,
  slotKey,
}: {
  areaById: ReadonlyMap<string, DashboardArea>;
  item: PlanItem;
  lifted?: boolean;
  now: number;
  slotKey: string;
}) {
  const isTask = item.kind === "task";
  const area = item.areaId == null ? undefined : areaById.get(item.areaId);
  const waiting = slotKey === "overdue" && item.date != null;
  const ConditionIcon = area ? conditionIcons[area.condition] : undefined;

  return (
    <div
      className={cn(
        "relative flex w-full items-start gap-2 overflow-hidden rounded-lg border py-2 pr-2 pl-2.5 text-left",
        isTask
          ? "border-dashed border-border bg-surface-2/60"
          : "border-border/70 bg-surface-2",
        waiting && "border-condition-attention/30 bg-condition-attention/8",
        lifted &&
          "border-border bg-surface-2 shadow-lg ring-1 ring-foreground/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          waiting
            ? "bg-condition-attention"
            : area == null || area.condition === "healthy"
              ? "bg-border"
              : conditionRailTone[area.condition],
        )}
      />

      <span
        className={cn(
          "mt-px flex size-6 shrink-0 items-center justify-center rounded-md",
          isTask
            ? "border border-dashed border-border bg-surface-2 text-muted-foreground"
            : conditionIconTone[area?.condition ?? "healthy"],
        )}
      >
        {isTask ? (
          <Inbox aria-hidden className="size-3" />
        ) : (
          <AreaIcon icon={area?.icon} className="size-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "line-clamp-2 text-[13px] leading-snug",
            isTask ? "font-normal text-foreground/90" : "font-medium",
          )}
        >
          {item.title}
        </span>

        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-snug text-muted-foreground/60">
          {ConditionIcon && area && area.condition !== "healthy" && (
            <ConditionIcon
              aria-hidden
              className={cn("size-2.5", conditionTextClassName[area.condition])}
            />
          )}
          <span className="truncate">{area?.name ?? "Inbox"}</span>
          {item.nextMove && (
            <>
              <span aria-hidden>·</span>
              <CornerDownRight aria-hidden className="size-2.5 shrink-0" />
              <span className="truncate">{item.nextMove}</span>
            </>
          )}
        </span>
      </span>

      {waiting && (
        <span className="mt-px shrink-0 text-[10px] font-medium tabular-nums text-condition-attention">
          {waitingLabel(item.date!, now)}
        </span>
      )}
    </div>
  );
}

function PlanChip({
  chrome,
  item,
  slotKey,
}: {
  chrome: GridChrome;
  item: PlanItem;
  slotKey: string;
}) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: item.id,
    data: { itemId: item.id, slotKey } satisfies ChipDrag,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={() => chrome.onOpen(item)}
      className={cn(
        // `touch-manipulation`, not `touch-none`: a swipe that starts on a chip
        // must still scroll the list until the long-press arms the drag.
        "w-full touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <ChipSurface
        areaById={chrome.areaById}
        item={item}
        now={chrome.now}
        slotKey={slotKey}
      />
    </button>
  );
}
