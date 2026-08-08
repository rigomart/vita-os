// PROTOTYPE — throwaway (issue #268). Variant B5: multi-day columns — a swipeable 3-day column view, chips stacked per day.

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
  waitingLabel,
} from "@/features/dashboard/plan/plan-model";

/**
 * Plan — multi-day columns (phone).
 *
 * Google Calendar's mobile **3-day view**, adapted to data that has no hours.
 * Three day columns share the viewport; because a Follow-up is day-granular
 * there is no hour axis to position against, so each column simply stacks its
 * chips top-down. Time runs left-to-right and you **page through it**: the
 * horizon is one column per day from yesterday to four weeks out, in a
 * snap-per-column scroller, so any three consecutive days can sit on screen.
 *
 * What the columns buy over a vertical agenda is *comparison*: Tuesday's load
 * next to Wednesday's is a glance, not a scroll. What they cost is width —
 * ~120px a column — so the chip drops its meta line and keeps only the parts
 * that survive at that size: the condition rail, the Area icon pill, and two
 * lines of title.
 *
 * The two non-days keep their own furniture. **Waiting** is a tinted tray above
 * the columns and **No date** a folded tray below: neither is a day, so neither
 * can be a column. This is a prototype: drops write to a local `moves` map,
 * never to Convex.
 */
export function PlanVariantMultiDay({
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
  const [drag, setDrag] = useState<MultiDayDrag | null>(null);
  const [showNoDate, setShowNoDate] = useState(false);
  /** Index into `COLUMNS` of the leftmost column currently on screen. */
  const [leftIndex, setLeftIndex] = useState(TODAY_INDEX);

  const pagerRef = useRef<HTMLDivElement | null>(null);

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

  const board = useMemo(() => buildBoard(visible, now), [visible, now]);

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of moved) {
      if (item.areaId == null) continue;
      counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
    }
    return counts;
  }, [moved]);

  /* ------------------------------------------------------------ paging -- */

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const pager = pagerRef.current;
    if (!pager) return;
    pager.scrollTo({
      behavior: smooth ? "smooth" : "auto",
      left: index * (pager.clientWidth / VISIBLE_DAYS),
    });
  }, []);

  /** Open with today as the leftmost column — the rest of the view is ahead. */
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      scrollToIndex(TODAY_INDEX, false),
    );
    return () => cancelAnimationFrame(frame);
  }, [scrollToIndex]);

  function handleScroll() {
    const pager = pagerRef.current;
    if (!pager) return;
    const width = pager.clientWidth / VISIBLE_DAYS;
    if (width <= 0) return;
    setLeftIndex(
      Math.max(
        0,
        Math.min(COLUMNS.length - 1, Math.round(pager.scrollLeft / width)),
      ),
    );
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
    // The past is not a target — the same rule the canvas enforces. Here that
    // covers both the Waiting tray and the yesterday column.
    if (isPast(over.slotKey)) return;
    if (over.slotKey === source.slotKey) return;

    if (over.slotKey === "none") setShowNoDate(true);
    setMoves((previous) => {
      const next = new Map(previous);
      next.set(source.itemId, over.slotKey);
      return next;
    });
  }

  const dragging = drag && visible.find((item) => item.id === drag.itemId);
  const caption = drag?.overSlotKey ? dropCaption(drag.overSlotKey, now) : null;

  const chrome: MultiDayChrome = { areaById, drag, now, onOpen: openItem };

  const leftDate = dayAt(COLUMNS[leftIndex] ?? 0, now);
  const onToday = leftIndex === TODAY_INDEX;

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col gap-2">
      {/* The narrowing that lane headers do on desktop. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
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
              "Drag sideways onto a day column to reschedule, or onto No date to clear it. Press Enter to open it instead.",
          },
        }}
      >
        {board.overdue.length > 0 && (
          <WaitingTray chrome={chrome} items={board.overdue} />
        )}

        {/* Where in time the pager is sitting, plus the way home. */}
        <div className="flex items-center gap-2 pt-1.5 pb-1">
          <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
            {format(new Date(leftDate), "MMMM yyyy")}
          </span>
          <span aria-hidden className="h-px flex-1 bg-border/60" />
          <button
            type="button"
            onClick={() => scrollToIndex(TODAY_INDEX, true)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[10px] font-semibold tracking-tight transition-colors",
              onToday
                ? "text-muted-foreground/45"
                : "bg-foreground text-surface-1",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                onToday ? "bg-muted-foreground/30" : "bg-brand-gold-strong",
              )}
            />
            Today
          </button>
        </div>

        {/* One column per day; snap per column, so any three consecutive days
            can share the screen. Snapping is dropped mid-drag so dnd-kit's
            auto-scroll is not fighting the snap points. */}
        <div
          ref={pagerRef}
          onScroll={handleScroll}
          className={cn(
            "flex h-[calc(100dvh_-_23rem)] max-h-[32rem] min-h-[17rem] overflow-x-auto overscroll-x-contain rounded-lg border border-border/60 [scrollbar-width:none]",
            drag ? "snap-none" : "snap-x snap-mandatory",
          )}
        >
          {COLUMNS.map((offset, index) => (
            <DayColumn
              key={dayKey(offset)}
              chrome={chrome}
              first={index === 0}
              items={board.byDay.get(dayKey(offset))}
              offset={offset}
            />
          ))}
        </div>

        <NoDateTray
          chrome={chrome}
          items={board.none}
          open={showNoDate}
          onToggle={() => setShowNoDate((previous) => !previous)}
        />

        <DragOverlay dropAnimation={null}>
          {dragging && drag && (
            <div className="w-[15rem] max-w-[75vw] cursor-grabbing">
              <ChipSurface
                areaById={areaById}
                detailed
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

      {board.total === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center font-heading text-sm font-semibold">
          Nothing to plan
        </p>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- model -- */

interface MultiDayDrag {
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

interface MultiDayChrome {
  areaById: ReadonlyMap<string, DashboardArea>;
  drag: MultiDayDrag | null;
  now: number;
  onOpen: (item: PlanItem) => void;
}

/** Columns on screen at once — the "3-day view" of the phone calendar. */
const VISIBLE_DAYS = 3;
/** Yesterday leads the horizon so today never sits flush against the edge. */
const PAST_DAYS = 1;
/** Four weeks of runway is enough to plan into without endless paging. */
const FORWARD_DAYS = 28;

/** Day offsets, in column order: yesterday first, today second. */
const COLUMNS: number[] = Array.from(
  { length: PAST_DAYS + FORWARD_DAYS + 1 },
  (_, index) => index - PAST_DAYS,
);
const TODAY_INDEX = PAST_DAYS;
const HORIZON = FORWARD_DAYS;

/** Yesterday's column and the Waiting tray share one rule: no drops. */
function isPast(slotKey: string): boolean {
  if (slotKey === "overdue") return true;
  if (slotKey === "none") return false;
  return Number(slotKey.slice(1)) < 0;
}

interface Board {
  byDay: Map<string, PlanItem[]>;
  none: PlanItem[];
  overdue: PlanItem[];
  total: number;
}

/**
 * One pass from `PlanItem[]` to per-column buckets.
 *
 * Every column exists whether or not anything is in it — a calendar that hides
 * Thursday stops being a calendar — so this only fills buckets; the columns
 * themselves come from the fixed `COLUMNS` horizon. Anything past the horizon
 * piles into the last column rather than vanishing.
 */
function buildBoard(items: PlanItem[], now: number): Board {
  const byDay = new Map<string, PlanItem[]>();
  const none: PlanItem[] = [];
  const overdue: PlanItem[] = [];

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
    const key = dayKey(Math.min(offset, HORIZON));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }

  for (const bucket of byDay.values()) bucket.sort(byDateThenTitle);
  overdue.sort(byDateThenTitle);
  none.sort(byDateThenTitle);

  return { byDay, none, overdue, total: items.length };
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
  if (isPast(slotKey))
    return { blocked: true, text: "Can't plan into the past" };
  if (slotKey === "none") return { blocked: false, text: "No date" };
  return {
    blocked: false,
    text: dayCaption(dayAt(Number(slotKey.slice(1)), now)),
  };
}

/* -------------------------------------------------------------- column -- */

const EMPTY: PlanItem[] = [];

/**
 * One day of the pager: header pinned at the top, chips stacked below it.
 *
 * The header is the phone-calendar date marker rotated into a column head —
 * weekday over day number, today's number in a filled accent disc — with the
 * month abbreviation surfacing only on the 1st, where the column would
 * otherwise lie about which month you are looking at. Weekends take the same
 * faint wash the desktop axis gives them.
 */
function DayColumn({
  chrome,
  first,
  items = EMPTY,
  offset,
}: {
  chrome: MultiDayChrome;
  first: boolean;
  items?: PlanItem[];
  offset: number;
}) {
  const key = dayKey(offset);
  const date = new Date(dayAt(offset, chrome.now));
  const isToday = offset === 0;
  const past = offset < 0;
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const monthStart = date.getDate() === 1;

  const { isOver, setNodeRef } = useDroppable({
    id: `slot::${key}`,
    data: { slotKey: key } satisfies SlotDrop,
  });
  const over = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-1/3 shrink-0 snap-start flex-col transition-colors",
        !first && "border-l border-border/50",
        isWeekend && "bg-foreground/[0.03]",
        past && "opacity-55",
        isToday && "bg-brand-accent-foreground/[0.05]",
        over &&
          (past ? "bg-condition-attention/10" : "bg-brand-gold-strong/15"),
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-col items-center gap-0.5 border-b bg-surface-1/85 pt-1.5 pb-1 backdrop-blur-sm",
          isToday ? "border-brand-accent-foreground/25" : "border-border/50",
        )}
      >
        <span
          className={cn(
            "text-[8px] leading-none font-semibold tracking-[0.08em] uppercase",
            monthStart ? "text-muted-foreground/70" : "text-transparent",
          )}
        >
          {format(date, "MMM")}
        </span>
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
          <span className="flex size-6 items-center justify-center rounded-full bg-brand-accent-foreground text-[13px] leading-none font-semibold tabular-nums text-surface-1">
            {format(date, "d")}
          </span>
        ) : (
          <span
            className={cn(
              "flex size-6 items-center justify-center text-[14px] leading-none font-semibold tabular-nums",
              isWeekend ? "text-muted-foreground/55" : "text-foreground/75",
            )}
          >
            {format(date, "d")}
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1 [scrollbar-width:none]",
          over && !past && "outline-1 outline-dashed outline-foreground/35",
        )}
      >
        {items.length === 0 ? (
          <span
            aria-hidden
            className="pt-3 text-center text-[11px] text-muted-foreground/20"
          >
            —
          </span>
        ) : (
          items.map((item) => (
            <DayChip key={item.id} chrome={chrome} item={item} slotKey={key} />
          ))
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- trays -- */

/**
 * Waiting sits above the columns because it is not a day: it is everything the
 * horizon has already passed. A row, not a stack — it scrolls sideways like the
 * pager under it, and never accepts a drop.
 */
function WaitingTray({
  chrome,
  items,
}: {
  chrome: MultiDayChrome;
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
        "rounded-xl bg-condition-attention/[0.07] transition-colors",
        rejecting && "ring-1 ring-condition-attention/30 ring-inset",
      )}
    >
      <div className="flex items-center gap-2 px-2.5 pt-1.5 pb-1">
        <span className="font-heading text-[11px] font-semibold tracking-[0.09em] text-condition-attention uppercase">
          Waiting
        </span>
        <span aria-hidden className="h-px flex-1 bg-condition-attention/20" />
        <span className="text-[10px] tabular-nums text-condition-attention">
          {items.length}
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-1.5 pb-2 [scrollbar-width:none]">
        {items.map((item) => (
          <DayChip
            key={item.id}
            chrome={chrome}
            className="w-[9.5rem] shrink-0"
            item={item}
            slotKey="overdue"
          />
        ))}
      </div>
    </div>
  );
}

/** The other non-day, folded away behind its count until asked for. */
function NoDateTray({
  chrome,
  items,
  onToggle,
  open,
}: {
  chrome: MultiDayChrome;
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
        "mt-1.5 rounded-xl border border-border/70 transition-colors",
        armed && "border-transparent bg-brand-gold-strong/15",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
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
        <div className="flex gap-1.5 overflow-x-auto px-1.5 pb-2 [scrollbar-width:none]">
          {items.length === 0 ? (
            <p className="py-1 pl-1 text-[11px] text-muted-foreground/40">
              Everything has a day
            </p>
          ) : (
            items.map((item) => (
              <DayChip
                key={item.id}
                chrome={chrome}
                className="w-[9.5rem] shrink-0"
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

/* ---------------------------------------------------------------- chip -- */

/**
 * Presentation only, so the lifted ghost is identical to the chip it left.
 *
 * The compact form is the one the columns use: at ~120px there is no room for
 * the Area name or the Next Move, so the chip keeps the parts that still read —
 * the condition rail down the left edge, the Area's icon in a condition-toned
 * pill, and two lines of title. `detailed` restores b2's meta line for the drag
 * overlay, which is free to be wider than the column it came from.
 */
function ChipSurface({
  areaById,
  detailed,
  item,
  lifted,
  now,
  slotKey,
}: {
  areaById: ReadonlyMap<string, DashboardArea>;
  detailed?: boolean;
  item: PlanItem;
  lifted?: boolean;
  now: number;
  slotKey: string;
}) {
  const isTask = item.kind === "task";
  const area = item.areaId == null ? undefined : areaById.get(item.areaId);
  const waiting = slotKey === "overdue" && item.date != null;
  const ConditionIcon = area ? conditionIcons[area.condition] : undefined;

  const rail = (
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
  );

  const pill = (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded",
        isTask
          ? "border border-dashed border-border bg-surface-2 text-muted-foreground"
          : conditionIconTone[area?.condition ?? "healthy"],
      )}
    >
      {isTask ? (
        <Inbox aria-hidden className="size-2.5" />
      ) : (
        <AreaIcon icon={area?.icon} className="size-3" />
      )}
    </span>
  );

  const shell = cn(
    "relative w-full overflow-hidden rounded-lg border text-left",
    isTask
      ? "border-dashed border-border bg-surface-2/60"
      : "border-border/70 bg-surface-2",
    waiting && "border-condition-attention/30 bg-condition-attention/8",
    lifted && "border-border bg-surface-2 shadow-lg ring-1 ring-foreground/10",
  );

  if (!detailed) {
    return (
      <div className={cn(shell, "flex flex-col gap-1 py-1.5 pr-1.5 pl-2")}>
        {rail}
        <span className="flex items-center gap-1">
          {pill}
          {waiting && (
            <span className="ml-auto text-[9px] font-medium tabular-nums text-condition-attention">
              {waitingLabel(item.date!, now)}
            </span>
          )}
        </span>
        <span
          className={cn(
            "line-clamp-2 text-[11px] leading-snug",
            isTask ? "font-normal text-foreground/90" : "font-medium",
          )}
        >
          {item.title}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(shell, "flex items-start gap-2 py-2 pr-2 pl-2.5")}>
      {rail}
      <span className="mt-px">{pill}</span>

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

function DayChip({
  chrome,
  className,
  item,
  slotKey,
}: {
  chrome: MultiDayChrome;
  className?: string;
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
        // must still page the columns until the long-press arms the drag.
        "w-full shrink-0 touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing",
        isDragging && "opacity-30",
        className,
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
