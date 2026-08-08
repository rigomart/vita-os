// PROTOTYPE — throwaway (issue #268). Variant B3: week strip — pinned swipeable week navigator over a synced calendar agenda.

import type { Condition } from "@convex/lib/condition";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

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
 * Plan — week strip (phone).
 *
 * B2 wears Google Calendar's Schedule view. This one wears Outlook mobile: the
 * same agenda, but with a **pinned week strip** riding above it. The strip is
 * the map, the agenda is the territory — seven day cells with condition dots,
 * one full-width page per week, swiped sideways for as far ahead as you plan.
 *
 * The strip does three jobs the agenda alone cannot. It **locates** you: the
 * day sitting at the top of the agenda viewport is the day the strip rings.
 * It **teleports** you: tapping any cell smooth-scrolls the agenda to that day,
 * opening a collapsed quiet run on the way if the day lives inside one. And it
 * **catches**: every cell is a drop target, so a chip can be rescheduled three
 * weeks out without the drag ever leaving the top of the screen — the long
 * distance reschedule a vertical agenda otherwise has no answer for. Past cells
 * refuse, with the same blocked caption the Waiting card shows.
 *
 * This is a prototype: drops write to a local `moves` map, never to Convex.
 */
export function PlanVariantWeekStrip({
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
  const [drag, setDrag] = useState<StripDrag | null>(null);
  const [openGaps, setOpenGaps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [showNoDate, setShowNoDate] = useState(false);
  /** The day currently under the strip — best-effort, from scroll math. */
  const [activeOffset, setActiveOffset] = useState(0);
  const [weekPage, setWeekPage] = useState(WEEKS_BACK);

  const stripRef = useRef<HTMLDivElement | null>(null);
  /** Day offset → its agenda row, for both scroll targeting and the highlight. */
  const dayNodes = useRef(new Map<number, HTMLElement>());
  /** A day tapped in the strip whose row does not exist yet (collapsed run). */
  const pendingScroll = useRef<number | null>(null);
  const stripReady = useRef(false);

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

  /* ------------------------------------------------------------- weeks -- */

  /** Offset of the Monday that opens the current week (0 or negative). */
  const weekStart = useMemo(() => -((new Date(now).getDay() + 6) % 7), [now]);
  /** The agenda has to reach every day the strip can point at. */
  const stripEnd = weekStart + WEEKS_AHEAD * 7 + 6;

  const schedule = useMemo(
    () => buildSchedule(visible, now, stripEnd),
    [visible, now, stripEnd],
  );

  /** Up to three condition dots per day, worst first. Includes the past. */
  const dotsByOffset = useMemo(() => {
    const byOffset = new Map<number, Condition[]>();
    for (const item of visible) {
      if (item.date == null) continue;
      const offset = dayDelta(item.date, now);
      const area = item.areaId == null ? undefined : areaById.get(item.areaId);
      const bucket = byOffset.get(offset);
      const condition = area?.condition ?? "healthy";
      if (bucket) bucket.push(condition);
      else byOffset.set(offset, [condition]);
    }
    for (const [offset, bucket] of byOffset) {
      bucket.sort((a, b) => conditionRank[a] - conditionRank[b]);
      byOffset.set(offset, bucket.slice(0, 3));
    }
    return byOffset;
  }, [visible, now, areaById]);

  const weeks = useMemo(() => {
    const pages: WeekPage[] = [];
    for (let page = 0; page < WEEK_PAGES; page += 1) {
      const from = weekStart + (page - WEEKS_BACK) * 7;
      const days: number[] = [];
      for (let day = 0; day < 7; day += 1) days.push(from + day);
      pages.push({ days, from, key: `w${from}` });
    }
    return pages;
  }, [weekStart]);

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
    (offset: number, node: HTMLElement | null) => {
      if (node) dayNodes.current.set(offset, node);
      else dayNodes.current.delete(offset);
    },
    [],
  );

  /** Land the day just under the strip, never behind it. */
  function scrollToNode(node: HTMLElement, smooth: boolean) {
    const top = node.getBoundingClientRect().top + window.scrollY - TOP_INSET;
    window.scrollTo({ behavior: smooth ? "smooth" : "auto", top });
  }

  /**
   * Tap-to-scroll, with one indirection: a day inside a folded quiet run has no
   * row yet, so open the run and finish the scroll on the next commit.
   */
  function scrollToDay(offset: number) {
    if (offset < 0) {
      window.scrollTo({ behavior: "smooth", top: 0 });
      return;
    }
    const node = dayNodes.current.get(offset);
    if (node) {
      scrollToNode(node, true);
      return;
    }
    const gap = schedule.rows.find(
      (row) => row.kind === "gap" && offset >= row.from && offset <= row.to,
    );
    if (gap?.kind !== "gap") return;
    pendingScroll.current = offset;
    setOpenGaps((previous) => new Set(previous).add(gap.from));
  }

  /** Runs every commit on purpose: the row we are waiting for may just exist. */
  useEffect(() => {
    const target = pendingScroll.current;
    if (target == null) return;
    const node = dayNodes.current.get(target);
    if (!node) return;
    pendingScroll.current = null;
    scrollToNode(node, true);
  });

  /** Open on today, the way a calendar app does. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const node = dayNodes.current.get(0);
      if (node) scrollToNode(node, false);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  /** Scroll → highlight. Approximate by design: last day above the strip line. */
  useEffect(() => {
    let frame = 0;
    function measure() {
      frame = 0;
      let best: number | null = null;
      let bestTop = -Infinity;
      let firstBelow: number | null = null;
      let firstTop = Infinity;
      for (const [offset, node] of dayNodes.current) {
        const top = node.getBoundingClientRect().top;
        if (top <= TOP_INSET + 8 && top > bestTop) {
          bestTop = top;
          best = offset;
        }
        if (top < firstTop) {
          firstTop = top;
          firstBelow = offset;
        }
      }
      const next = best ?? firstBelow;
      if (next != null) setActiveOffset(next);
    }
    function onScroll() {
      if (frame === 0) frame = requestAnimationFrame(measure);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  /** Highlight → strip page. The strip follows the agenda, never the reverse. */
  useEffect(() => {
    const element = stripRef.current;
    if (!element) return;
    const page = Math.min(
      WEEK_PAGES - 1,
      Math.max(0, WEEKS_BACK + Math.floor((activeOffset - weekStart) / 7)),
    );
    const smooth = stripReady.current;
    stripReady.current = true;
    element.scrollTo({
      behavior: smooth ? "smooth" : "auto",
      left: element.clientWidth * page,
    });
  }, [activeOffset, weekStart]);

  function handleStripScroll() {
    const element = stripRef.current;
    if (!element || element.clientWidth === 0) return;
    setWeekPage(Math.round(element.scrollLeft / element.clientWidth));
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
    // The past is not a target — the same rule the canvas enforces, and the one
    // every past strip cell reports.
    if (over.slotKey === "overdue") return;
    if (over.slotKey === source.slotKey) return;

    if (over.slotKey === "none") setShowNoDate(true);
    setMoves((previous) => {
      const next = new Map(previous);
      next.set(source.itemId, over.slotKey);
      return next;
    });

    // A strip drop lands the chip off-screen, so follow it down.
    if (over.fromStrip && over.slotKey !== "none") {
      pendingScroll.current = Number(over.slotKey.slice(1));
    }
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

  const chrome: StripChrome = {
    areaById,
    drag,
    now,
    onOpen: openItem,
    registerDay,
  };

  const visibleWeek = weeks[Math.min(weekPage, weeks.length - 1)];
  const stripLabel = monthLabel(dayAt(visibleWeek.from + 3, now));

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col gap-2">
      {/* The narrowing that lane headers do on desktop. Above the strip so the
          strip stays welded to the agenda it drives. */}
      <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
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
              "Drag onto a day in the week strip or the agenda to reschedule, or onto No date to clear it. Press Enter to open it instead.",
          },
        }}
      >
        {/* ------------------------------------------------- week strip -- */}
        <div className="sticky top-12 z-20 -mx-1 border-b border-border/50 bg-surface-1/95 px-1 pb-1.5 backdrop-blur-sm">
          <div className="flex items-center justify-between px-0.5 pt-1.5 pb-1">
            <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
              {stripLabel}
            </span>
            {activeOffset !== 0 && (
              <button
                type="button"
                onClick={() => scrollToDay(0)}
                className="flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-brand-gold-strong"
                />
                Today
              </button>
            )}
          </div>

          <div
            ref={stripRef}
            onScroll={handleStripScroll}
            className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
          >
            {weeks.map((week) => (
              <div
                key={week.key}
                className="grid w-full shrink-0 snap-start grid-cols-7"
              >
                {week.days.map((offset) => (
                  <StripDay
                    key={offset}
                    activeOffset={activeOffset}
                    chrome={chrome}
                    dots={dotsByOffset.get(offset)}
                    offset={offset}
                    onSelect={() => scrollToDay(offset)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------- agenda -- */}
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

      {schedule.total === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center font-heading text-sm font-semibold">
          Nothing to plan
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- grouping -- */

interface StripDrag {
  itemId: string;
  overSlotKey?: string;
  slotKey: string;
}

interface ChipDrag {
  itemId: string;
  slotKey: string;
}

interface SlotDrop {
  /** Strip drops reschedule out of view, so the agenda follows the chip. */
  fromStrip?: boolean;
  slotKey: string;
}

interface StripChrome {
  areaById: ReadonlyMap<string, DashboardArea>;
  drag: StripDrag | null;
  now: number;
  onOpen: (item: PlanItem) => void;
  registerDay: (offset: number, node: HTMLElement | null) => void;
}

interface WeekPage {
  days: number[];
  from: number;
  key: string;
}

type ScheduleRow =
  | { from: number; key: string; kind: "gap"; to: number }
  | { key: string; kind: "day"; offset: number }
  | { key: string; kind: "month"; label: string };

/** One week back, eight forward — the whole range the strip can point at. */
const WEEKS_BACK = 1;
const WEEKS_AHEAD = 8;
const WEEK_PAGES = WEEKS_BACK + WEEKS_AHEAD + 1;

const MAX_HORIZON = 90;

/** Sticky app bar (48px) plus the pinned week strip. */
const TOP_INSET = 136;

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
  healthy: "bg-muted-foreground/40",
};

interface Schedule {
  byDay: Map<string, PlanItem[]>;
  none: PlanItem[];
  overdue: PlanItem[];
  rows: ScheduleRow[];
  total: number;
}

/**
 * One pass from `PlanItem[]` to the rows the agenda renders.
 *
 * `minHorizon` is what the strip demands: every cell the strip shows must have
 * a day to scroll to, so the agenda always reaches the last strip page even
 * when nothing is planned that far out.
 */
function buildSchedule(
  items: PlanItem[],
  now: number,
  minHorizon: number,
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

  const horizon = Math.min(MAX_HORIZON, Math.max(minHorizon, furthest));

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

/* ----------------------------------------------------------- week strip -- */

/**
 * One cell of the pinned strip: two-letter weekday, day number, condition dots.
 *
 * Three roles at once — a label, a jump button, and a drop target. Today keeps
 * the filled accent disc from B2's rail; the day at the top of the agenda gets
 * a ring instead, so "where I am" and "what day it is" never collide. Past
 * cells still show their dots (the debt happened) but refuse the drop.
 */
function StripDay({
  activeOffset,
  chrome,
  dots,
  offset,
  onSelect,
}: {
  activeOffset: number;
  chrome: StripChrome;
  dots?: Condition[];
  offset: number;
  onSelect: () => void;
}) {
  const at = dayAt(offset, chrome.now);
  const date = new Date(at);
  const isToday = offset === 0;
  const isPast = offset < 0;
  const isActive = offset === activeOffset && !isToday;
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;

  const { isOver, setNodeRef } = useDroppable({
    id: `strip::${offset}`,
    data: {
      fromStrip: true,
      slotKey: isPast ? "overdue" : dayKey(offset),
    } satisfies SlotDrop,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-current={isToday ? "date" : undefined}
      onClick={onSelect}
      className={cn(
        "flex touch-manipulation flex-col items-center gap-1 rounded-lg py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        armed &&
          (isPast
            ? "bg-surface-3 ring-1 ring-border ring-inset"
            : "bg-brand-gold-strong/20 ring-1 ring-brand-gold-strong/60 ring-inset"),
      )}
    >
      <span
        className={cn(
          "text-[9px] leading-none font-semibold tracking-[0.06em] uppercase",
          isToday
            ? "text-brand-accent-foreground"
            : isPast
              ? "text-muted-foreground/30"
              : isWeekend
                ? "text-muted-foreground/45"
                : "text-muted-foreground/70",
        )}
      >
        {format(date, "EEEEEE")}
      </span>

      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full text-[14px] leading-none font-semibold tabular-nums",
          isToday
            ? "bg-brand-accent-foreground text-surface-1"
            : isActive
              ? "text-foreground ring-1 ring-foreground/35"
              : isPast
                ? "text-muted-foreground/35"
                : isWeekend
                  ? "text-muted-foreground/60"
                  : "text-foreground/80",
        )}
      >
        {format(date, "d")}
      </span>

      <span aria-hidden className="flex h-1 items-center gap-[3px]">
        {(dots ?? []).map((condition, index) => (
          <span
            key={index}
            className={cn(
              "size-1 rounded-full",
              conditionDotTone[condition],
              isPast && "opacity-45",
            )}
          />
        ))}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- furniture -- */

/**
 * Month divider. Deliberately **not** sticky in this variant: the week strip
 * already owns the pinned band under the app bar, and two stacked sticky
 * headers on a 390px screen is a fight nobody wins.
 */
function MonthBand({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1.5">
      <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border/60" />
    </div>
  );
}

/**
 * The date marker of the agenda: weekday over day number, in a fixed 48px
 * column. Today's number sits in a filled accent disc — the same treatment the
 * strip gives it, so the two surfaces read as one calendar.
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
 * becomes a hairline, so the day stays a visible, droppable place. Every row
 * registers itself so the strip can both scroll to it and read it back.
 */
function DayRow({
  chrome,
  items = EMPTY,
  offset,
}: {
  chrome: StripChrome;
  items?: PlanItem[];
  offset: number;
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

  const { registerDay } = chrome;
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      registerDay(offset, node);
    },
    [setNodeRef, registerDay, offset],
  );

  return (
    <div
      ref={attach}
      className={cn(
        "relative flex scroll-mt-36 items-stretch rounded-md transition-colors",
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
          <PlanChip key={item.id} chrome={chrome} item={item} slotKey={key} />
        ))}
      </div>
    </div>
  );
}

/**
 * A run of quiet days past the near horizon, as one line. Tapping it — or
 * tapping a day inside it on the strip — opens the run into the same hairline
 * day rows the near horizon prints.
 */
function GapRow({
  chrome,
  from,
  onToggle,
  open,
  to,
}: {
  chrome: StripChrome;
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
  chrome: StripChrome;
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
        "mt-1 mb-1 rounded-xl bg-condition-attention/[0.07] transition-colors",
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
  chrome: StripChrome;
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
 * Area's icon in a condition-toned pill. An inbox Task wears a dashed pill and
 * the Inbox glyph instead; it has no Area to wear.
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
  chrome: StripChrome;
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
