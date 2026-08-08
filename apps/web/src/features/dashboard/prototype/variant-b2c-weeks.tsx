// PROTOTYPE — throwaway (issue #268). Variant B2C: canon calendar schedule chunked into week sections.

import type { Condition } from "@convex/lib/condition";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import type { RefObject } from "react";

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
import { format } from "date-fns";
import {
  Ban,
  ChevronDown,
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
 * Plan — calendar schedule, chunked into weeks (phone).
 *
 * B2's schedule verbatim — 48px date rail, hairline empty days, floating Today
 * pill, local-state drops — with one structural change: the scroll is cut into
 * **week sections**. A slim header opens each week ("This week", "Next week",
 * then "18–24 Aug"), carries that week's load on the right (a planned count and,
 * when the week touches a strained Area, a worst-condition dot), and gives the
 * list the weekly cadence every calendar app scrolls in.
 *
 * The week is also the unit of *place*. A week holding anything prints all seven
 * of its days, empty ones as droppable hairlines; a week holding nothing folds to
 * its header alone ("18–24 Aug · quiet") until tapped, and consecutive quiet
 * weeks merge into one "3 quiet weeks" line. That collapse replaces B2's "N quiet
 * days" gap rows: granularity moves from the day to the week.
 *
 * Month bands are gone with the gaps — the week headers carry the rhythm — so a
 * single band pins under the app bar and names the month of whichever week is
 * currently at the top of the viewport. Drops still write to a local `moves` map,
 * never to Convex.
 */
export function PlanVariantWeeks({
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
  const [drag, setDrag] = useState<CalendarDrag | null>(null);
  /** Week indices whose quiet week has been opened into its seven days. */
  const [openWeeks, setOpenWeeks] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  /** Run keys (first week index) whose merged "N quiet weeks" line is open. */
  const [openRuns, setOpenRuns] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [showNoDate, setShowNoDate] = useState(false);
  const [todayInView, setTodayInView] = useState(true);
  const [bandWeek, setBandWeek] = useState(0);

  const todayRef = useRef<HTMLDivElement | null>(null);
  /** Week index → its header node, for the sticky month band. */
  const headers = useRef(new Map<number, HTMLElement>());

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

  const schedule = useMemo(
    () => buildSchedule(visible, now, areaById),
    [visible, now, areaById],
  );

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of moved) {
      if (item.areaId == null) continue;
      counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
    }
    return counts;
  }, [moved]);

  /* ------------------------------------------------------------ today -- */

  const scrollToToday = useCallback((smooth: boolean) => {
    const node = todayRef.current;
    if (!node) return;
    // The list lives in normal page flow, so the window is the scroller. Leave
    // room for the sticky app bar plus the month band that pins under it.
    const top = node.getBoundingClientRect().top + window.scrollY - TOP_INSET;
    window.scrollTo({ behavior: smooth ? "smooth" : "auto", top });
  }, []);

  /** Open on today, the way a calendar app does. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToToday(false));
    return () => cancelAnimationFrame(frame);
  }, [scrollToToday]);

  useEffect(() => {
    const node = todayRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTodayInView(entry.isIntersecting),
      { rootMargin: `-${TOP_INSET}px 0px -25% 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------- month band -- */

  const registerHeader = useCallback(
    (index: number, node: HTMLElement | null) => {
      if (node) headers.current.set(index, node);
      else headers.current.delete(index);
    },
    [],
  );

  /**
   * The band names the topmost visible week: the last header that has scrolled
   * past the app bar, or the first one while the list is still at its top.
   * A dozen headers, read on a rAF-throttled scroll — cheap enough to stay
   * honest without a per-header observer.
   */
  useEffect(() => {
    let frame = 0;

    function measure() {
      frame = 0;
      let above: number | null = null;
      let first: number | null = null;
      for (const [index, node] of headers.current) {
        if (first == null || index < first) first = index;
        const { top } = node.getBoundingClientRect();
        if (top <= TOP_INSET + 8 && (above == null || index > above)) {
          above = index;
        }
      }
      setBandWeek(above ?? first ?? 0);
    }

    function onScroll() {
      if (frame === 0) frame = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [schedule, openWeeks, openRuns]);

  const bandLabel =
    schedule.weeks[bandWeek]?.monthLabel ?? schedule.weeks[0]?.monthLabel ?? "";

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
    // The past is not a target — the same rule the canvas enforces.
    if (over.slotKey === "overdue") return;
    if (over.slotKey === source.slotKey) return;

    if (over.slotKey === "none") setShowNoDate(true);
    setMoves((previous) => {
      const next = new Map(previous);
      next.set(source.itemId, over.slotKey);
      return next;
    });
  }

  function toggleWeek(index: number) {
    setOpenWeeks((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleRun(key: number) {
    setOpenRuns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const dragging = drag && visible.find((item) => item.id === drag.itemId);
  const caption = drag?.overSlotKey ? dropCaption(drag.overSlotKey, now) : null;

  const chrome: CalendarChrome = {
    areaById,
    drag,
    now,
    onOpen: openItem,
    registerHeader,
  };

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col gap-2.5">
      {/* The narrowing that lane headers do on desktop. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <div className="w-max">
          <AreaFilterChips
            active={activeAreas}
            areas={areas}
            counts={areaCounts}
            onChange={setActiveAreas}
          />
        </div>
      </div>

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
              "Drag up or down onto a day to reschedule, or onto No date to clear it. Press Enter to open it instead.",
          },
        }}
      >
        <div className="flex flex-col">
          {schedule.overdue.length > 0 && (
            <OverdueSection chrome={chrome} items={schedule.overdue} />
          )}

          <MonthBand label={bandLabel} />

          {schedule.rows.map((row) => {
            if (row.kind === "week") {
              return (
                <WeekSection
                  key={row.key}
                  byDay={schedule.byDay}
                  chrome={chrome}
                  todayRef={todayRef}
                  week={row.week}
                />
              );
            }
            return (
              <QuietRun
                key={row.key}
                chrome={chrome}
                openRun={openRuns.has(row.weeks[0].index)}
                openWeeks={openWeeks}
                onToggleRun={() => toggleRun(row.weeks[0].index)}
                onToggleWeek={toggleWeek}
                weeks={row.weeks}
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
          onClick={() => scrollToToday(true)}
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

/* ------------------------------------------------------------- grouping -- */

interface CalendarDrag {
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

interface CalendarChrome {
  areaById: ReadonlyMap<string, DashboardArea>;
  drag: CalendarDrag | null;
  now: number;
  onOpen: (item: PlanItem) => void;
  registerHeader: (index: number, node: HTMLElement | null) => void;
}

/** One Monday-to-Sunday block of the schedule. */
interface WeekBlock {
  /** Planned items landing inside the block. */
  count: number;
  hasToday: boolean;
  /** 0 is the week holding today, 1 the next, and so on. */
  index: number;
  key: string;
  /** "This week", "Next week", or "18–24 Aug". */
  label: string;
  /** What the sticky band prints while this week is on top. */
  monthLabel: string;
  /** Rendered day offsets — the current week starts at today, not Monday. */
  offsets: number[];
  /** Nothing planned, no today, past the near horizon: folds to its header. */
  quiet: boolean;
  /** Worst Area condition anywhere in the block, healthy excluded. */
  worst?: Condition;
}

type ScheduleRow =
  | { key: string; kind: "quiet"; weeks: WeekBlock[] }
  | { key: string; kind: "week"; week: WeekBlock };

/** The list always reaches this far so there is somewhere to plan into. */
const MIN_HORIZON = 27;
const MAX_HORIZON = 90;

/** Sticky app bar (48px) plus the month band that pins under it. */
const TOP_INSET = 80;

/** The date rail. Wide enough for "WED" over a two-digit day at 15px. */
const RAIL = "w-12 shrink-0";

const conditionRank: Record<Condition, number> = {
  critical: 0,
  needs_attention: 1,
  healthy: 2,
};

const conditionDotTone: Record<Condition, string> = {
  critical: "bg-condition-critical",
  needs_attention: "bg-condition-attention",
  healthy: "bg-transparent",
};

interface Schedule {
  byDay: Map<string, PlanItem[]>;
  none: PlanItem[];
  overdue: PlanItem[];
  rows: ScheduleRow[];
  total: number;
  /** Indexed by week index, for the sticky band lookup. */
  weeks: WeekBlock[];
}

/**
 * One pass from `PlanItem[]` to the week sections the schedule renders.
 *
 * The horizon is B2's (`MIN_HORIZON`…`MAX_HORIZON`) rounded up to a whole week,
 * so the list never ends mid-week. Inside a week that holds anything, every day
 * prints — an empty Thursday is a place, not an absence. A week that holds
 * nothing folds to its header, and runs of those merge into one line.
 */
function buildSchedule(
  items: PlanItem[],
  now: number,
  areaById: ReadonlyMap<string, DashboardArea>,
): Schedule {
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

  // Monday one: today's week starts at a negative offset unless today is Monday.
  const weekOrigin = -((new Date(now).getDay() + 6) % 7);
  const reach = Math.min(MAX_HORIZON, Math.max(MIN_HORIZON, furthest));
  const weekCount = Math.ceil((reach - weekOrigin + 1) / 7);
  const horizon = weekOrigin + weekCount * 7 - 1;

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

  const weeks: WeekBlock[] = [];
  for (let index = 0; index < weekCount; index += 1) {
    const start = weekOrigin + index * 7;
    const offsets: number[] = [];
    for (let offset = Math.max(0, start); offset <= start + 6; offset += 1) {
      offsets.push(offset);
    }

    let count = 0;
    let worst: Condition | undefined;
    for (const offset of offsets) {
      const bucket = byDay.get(dayKey(offset));
      if (!bucket) continue;
      count += bucket.length;
      for (const item of bucket) {
        const condition =
          item.areaId == null
            ? undefined
            : areaById.get(item.areaId)?.condition;
        if (condition == null || condition === "healthy") continue;
        if (worst == null || conditionRank[condition] < conditionRank[worst]) {
          worst = condition;
        }
      }
    }

    const hasToday = offsets.includes(0);
    weeks.push({
      count,
      hasToday,
      index,
      key: `w${index}`,
      label: weekLabel(index, start, now),
      // ISO's own rule for which month a week belongs to: its Thursday.
      monthLabel: format(new Date(dayAt(start + 3, now)), "MMMM yyyy"),
      offsets,
      // The near horizon prints in full whatever it holds, exactly as B2 does.
      quiet: count === 0 && !hasToday && start >= NEAR_DAYS,
      worst,
    });
  }

  const rows: ScheduleRow[] = [];
  let run: WeekBlock[] = [];
  function flushRun() {
    if (run.length === 0) return;
    rows.push({ key: `q${run[0].index}`, kind: "quiet", weeks: run });
    run = [];
  }
  for (const week of weeks) {
    if (week.quiet) {
      run.push(week);
      continue;
    }
    flushRun();
    rows.push({ key: week.key, kind: "week", week });
  }
  flushRun();

  return { byDay, none, overdue, rows, total: items.length, weeks };
}

/** "This week", "Next week", then "18–24 Aug" / "31 Aug – 6 Sep". */
function weekLabel(index: number, start: number, now: number): string {
  if (index === 0) return "This week";
  if (index === 1) return "Next week";
  const from = new Date(dayAt(start, now));
  const to = new Date(dayAt(start + 6, now));
  if (from.getMonth() === to.getMonth()) {
    return `${format(from, "d")}–${format(to, "d MMM")}`;
  }
  return `${format(from, "d MMM")} – ${format(to, "d MMM")}`;
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

/* -------------------------------------------------------------- furniture -- */

/**
 * The single band, pinned under the app bar. Where B2 printed one per month
 * crossing, this one is always on screen and re-labels itself from whichever
 * week header is currently at the top of the viewport.
 */
function MonthBand({ label }: { label: string }) {
  return (
    <div className="sticky top-12 z-10 -mx-1 flex items-center gap-2 bg-surface-1/95 px-1 pt-3 pb-1.5 backdrop-blur-sm">
      <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/**
 * The structural move of this variant: a slim full-width line that opens a week
 * and states its load — how many items are planned into it and, if any of them
 * belong to a strained Area, a dot in that Area's condition.
 */
function WeekHeader({
  chrome,
  week,
}: {
  chrome: CalendarChrome;
  week: WeekBlock;
}) {
  return (
    <div
      ref={(node) => chrome.registerHeader(week.index, node)}
      className="flex min-h-6 items-center gap-2 pt-3 pb-1"
    >
      <span
        className={cn(
          "font-heading text-[11px] font-semibold tracking-tight",
          week.hasToday ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {week.label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border/50" />
      {week.worst && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", conditionDotTone[week.worst])}
        />
      )}
      {week.count > 0 && (
        <span className="text-[10px] tabular-nums text-muted-foreground/60">
          {week.count}
        </span>
      )}
    </div>
  );
}

/**
 * The date marker of the whole variant: weekday over day number, in a fixed
 * 48px column. Today's number sits in a filled accent disc — the phone-calendar
 * idiom, and the same accent the desktop ruler paints its now-rule with.
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
 * One calendar day: rail on the left, chips stacked to its right.
 *
 * An empty day keeps the row and loses only the chips — the content column
 * becomes a hairline, so the day stays a visible, droppable place.
 */
function DayRow({
  chrome,
  items = EMPTY,
  offset,
  rowRef,
}: {
  chrome: CalendarChrome;
  items?: PlanItem[];
  offset: number;
  rowRef?: RefObject<HTMLDivElement | null>;
}) {
  const key = dayKey(offset);
  const date = new Date(dayAt(offset, chrome.now));
  const isToday = offset === 0;
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const empty = items.length === 0;

  const { isOver, setNodeRef } = useDroppable({
    id: `slot::${key}`,
    data: { slotKey: key } satisfies SlotDrop,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (rowRef) rowRef.current = node;
      }}
      className={cn(
        "relative flex items-stretch rounded-md transition-colors",
        isToday && "bg-brand-accent-foreground/[0.05]",
        armed && "bg-brand-gold-strong/15",
      )}
    >
      {isToday && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] rounded-full bg-brand-accent-foreground/70"
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
          <CalendarChip
            key={item.id}
            chrome={chrome}
            item={item}
            slotKey={key}
          />
        ))}
      </div>
    </div>
  );
}

/** A week that holds something: its header, then all of its days. */
function WeekSection({
  byDay,
  chrome,
  todayRef,
  week,
}: {
  byDay: Map<string, PlanItem[]>;
  chrome: CalendarChrome;
  todayRef: RefObject<HTMLDivElement | null>;
  week: WeekBlock;
}) {
  return (
    <div className="flex flex-col">
      <WeekHeader chrome={chrome} week={week} />
      {week.offsets.map((offset) => (
        <DayRow
          key={dayKey(offset)}
          chrome={chrome}
          items={byDay.get(dayKey(offset))}
          offset={offset}
          rowRef={offset === 0 ? todayRef : undefined}
        />
      ))}
    </div>
  );
}

/**
 * A run of quiet weeks. One of them prints as its own folded header; two or
 * more merge into a single "3 quiet weeks" line, so a month with nothing in it
 * costs one row instead of four — and still opens down to a day you can drop on.
 */
function QuietRun({
  chrome,
  onToggleRun,
  onToggleWeek,
  openRun,
  openWeeks,
  weeks,
}: {
  chrome: CalendarChrome;
  onToggleRun: () => void;
  onToggleWeek: (index: number) => void;
  openRun: boolean;
  openWeeks: ReadonlySet<number>;
  weeks: WeekBlock[];
}) {
  if (weeks.length === 1) {
    return (
      <QuietWeek
        chrome={chrome}
        open={openWeeks.has(weeks[0].index)}
        onToggle={() => onToggleWeek(weeks[0].index)}
        week={weeks[0]}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={openRun}
        onClick={onToggleRun}
        className="flex items-center gap-2 pt-3 pb-1 text-left"
      >
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/55">
          <span className="tabular-nums">{weeks.length}</span>
          quiet weeks
          {openRun ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/30" />
      </button>

      {openRun &&
        weeks.map((week) => (
          <QuietWeek
            key={week.key}
            chrome={chrome}
            open={openWeeks.has(week.index)}
            onToggle={() => onToggleWeek(week.index)}
            week={week}
          />
        ))}
    </div>
  );
}

/**
 * A single empty week, folded to its header line. Tapping it prints the seven
 * hairline day rows underneath, so a far-off Tuesday stays one tap from a drop
 * without spending a screenful of list on it.
 */
function QuietWeek({
  chrome,
  onToggle,
  open,
  week,
}: {
  chrome: CalendarChrome;
  onToggle: () => void;
  open: boolean;
  week: WeekBlock;
}) {
  return (
    <div className="flex flex-col">
      <button
        ref={(node) => chrome.registerHeader(week.index, node)}
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-6 items-center gap-2 pt-3 pb-1 text-left"
      >
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/45">
          {week.label}
          {!open && <span aria-hidden>· quiet</span>}
          {open ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/30" />
      </button>

      {open &&
        week.offsets.map((offset) => (
          <DayRow key={dayKey(offset)} chrome={chrome} offset={offset} />
        ))}
    </div>
  );
}

/** Above the weeks: the debt, not a plan. Never accepts a drop. */
function OverdueSection({
  chrome,
  items,
}: {
  chrome: CalendarChrome;
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
        "mb-1 rounded-xl bg-condition-attention/[0.07] transition-colors",
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
          <CalendarChip
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
  chrome: CalendarChrome;
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
              <CalendarChip
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
 * Area's icon in a condition-toned pill — a calendar event block that happens to
 * carry an Area instead of a colour-coded calendar. An inbox Task wears a dashed
 * pill and the Inbox glyph instead; it has no Area to wear.
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

function CalendarChip({
  chrome,
  item,
  slotKey,
}: {
  chrome: CalendarChrome;
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
