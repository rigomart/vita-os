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
  Compass,
  CornerDownRight,
  Inbox,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";

import type { PlanItem, PlanItemKind } from "./plan-model";
import type { PlanActions } from "./use-plan-actions";

import { AreaFilterChips } from "./plan-filters";
import {
  buildPlanItems,
  conditionIconTone,
  conditionRailTone,
  dayAt,
  dayKey,
  waitingLabel,
} from "./plan-model";
import {
  buildSchedule,
  monthLabel,
  planScheduleDrop,
} from "./plan-schedule-model";

/**
 * Plan — the phone schedule: the canvas's model as a vertical agenda. Area
 * collapses from a lane into a chip attribute; the near horizon prints every
 * day, empty ones included, and quiet stretches past it fold into a tappable
 * "N quiet days".
 *
 * Opens on today. A long-press lifts a chip; dropping it writes the date
 * through the app's own mutations, as the canvas does.
 */
export function PlanSchedule({
  areas,
  currentDate,
  planActions,
  tasks,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  planActions: PlanActions;
  tasks: DashboardInboxTask[];
  threads: DashboardThread[];
}) {
  const now = currentDate;
  const navigate = useNavigate();
  const { planTask, planThread } = planActions;

  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );
  const [drag, setDrag] = useState<ScheduleDrag | null>(null);
  const [openGaps, setOpenGaps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [showNoDate, setShowNoDate] = useState(false);
  const [todayInView, setTodayInView] = useState(true);

  const todayRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);

  /** The same guards as the canvas: 5px for mouse, long-press for touch. */
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

  /** Tasks have no Area, so the Area filter never hides them. */
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.kind === "task" ||
          activeAreas == null ||
          (item.areaId != null && activeAreas.has(item.areaId)),
      ),
    [items, activeAreas],
  );

  const schedule = useMemo(() => buildSchedule(visible, now), [visible, now]);

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.areaId == null) continue;
      counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  /**
   * How much of the top of the viewport is already spoken for. The app bar is
   * fixed, but the month band under it is type that reflows, so it is measured
   * rather than assumed.
   */
  const topInset = useCallback(
    () => APP_BAR + (bandRef.current?.offsetHeight ?? 0),
    [],
  );

  const scrollToToday = useCallback(
    (smooth: boolean) => {
      const node = todayRef.current;
      if (!node) return;
      // The list lives in normal page flow, so the window is the scroller.
      const top =
        node.getBoundingClientRect().top + window.scrollY - topInset();
      window.scrollTo({ behavior: smooth ? "smooth" : "auto", top });
    },
    [topInset],
  );

  /** Open on today, the way a calendar app does. */
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToToday(false));
    return () => cancelAnimationFrame(frame);
  }, [scrollToToday]);

  useEffect(() => {
    const node = todayRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setTodayInView(entry.isIntersecting),
      { rootMargin: `-${topInset()}px 0px -25% 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [topInset]);

  function openItem(item: PlanItem) {
    // Tasks have no rail of their own; the Inbox is where a Task is handled.
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

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ScheduleDragData | undefined;
    if (!data) return;
    setDrag({ itemId: data.itemId, slotKey: data.slotKey });
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.data.current as ScheduleSlotData | undefined;
    setDrag((previous) =>
      previous ? { ...previous, overSlotKey: over?.slotKey } : previous,
    );
  }

  /** Decided from the event alone, never from `drag` state — see the note in `plan-canvas.tsx`. */
  function handleDragEnd(event: DragEndEvent) {
    setDrag(null);

    const source = event.active.data.current as ScheduleDragData | undefined;
    const over = event.over?.data.current as ScheduleSlotData | undefined;
    if (!source || !over) return;

    const plan = planScheduleDrop(source.slotKey, over.slotKey, now);
    if (!plan?.valid || !plan.reschedule) return;

    const date = plan.clears ? undefined : plan.date;
    // An item dropped into a folded-away section has to be visible where it
    // landed, or the drop reads as a deletion.
    if (plan.clears) setShowNoDate(true);

    if (source.kind === "task") {
      planTask(source.itemId, date);
      return;
    }
    planThread(source.itemId, { followUp: date });
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
  const dropPlan =
    drag?.overSlotKey == null
      ? null
      : planScheduleDrop(drag.slotKey, drag.overSlotKey, now);

  const chrome: ScheduleChrome = { areaById, drag, now, onOpen: openItem };
  const firstBandKey = schedule.rows.find((row) => row.kind === "month")?.key;

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
            <WaitingSection chrome={chrome} items={schedule.overdue} />
          )}

          {schedule.rows.map((row) => {
            if (row.kind === "month") {
              return (
                <MonthBand
                  key={row.key}
                  bandRef={row.key === firstBandKey ? bandRef : undefined}
                  label={row.label}
                />
              );
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
                rowRef={row.offset === 0 ? todayRef : undefined}
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
              {dropPlan && (
                <span
                  className={cn(
                    "mt-1.5 ml-1 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-2xs font-semibold shadow-sm",
                    dropPlan.valid
                      ? "bg-foreground text-surface-1"
                      : cn("bg-surface-2 ring-1 ring-border/50", MUTE_SOFT),
                  )}
                >
                  {dropPlan.valid ? (
                    <CornerDownRight className="size-3 shrink-0" />
                  ) : (
                    <Ban className="size-3 shrink-0" />
                  )}
                  {dropPlan.caption}
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
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 font-heading text-xs font-semibold tracking-tight text-surface-1 shadow-lg"
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-brand-gold-strong"
          />
          Today
        </button>
      )}

      {schedule.total === 0 && (
        <p
          className={cn(
            "mt-3 rounded-2xl border border-dashed p-10 text-center font-heading text-sm font-semibold",
            HAIRLINE,
          )}
        >
          Nothing to plan
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- internals -- */

interface ScheduleDrag {
  itemId: string;
  overSlotKey?: string;
  slotKey: string;
}

interface ScheduleDragData {
  itemId: string;
  kind: PlanItemKind;
  slotKey: string;
}

interface ScheduleSlotData {
  slotKey: string;
}

/** What every row needs and none of them should have to thread individually. */
interface ScheduleChrome {
  areaById: ReadonlyMap<string, DashboardArea>;
  drag: ScheduleDrag | null;
  now: number;
  onOpen: (item: PlanItem) => void;
}

/** The app bar the month band pins under. */
const APP_BAR = 48;

/** The date rail. Wide enough for "WED" over a two-digit day in a 28px disc. */
const RAIL = "w-12 shrink-0";

/**
 * Every day row clears the rail: 4px lead + 11px weekday + 2px gap + 28px disc
 * is 45px, rounded to 48. Empty days are the same 48px — the rail sets the
 * floor, which also makes an empty day a fingertip-sized drop target.
 */
const ROW_MIN = "min-h-12";

/** The three muting steps. Faint tones pick one rather than inventing an alpha. */
const MUTE = "text-muted-foreground";
const MUTE_SOFT = "text-muted-foreground/70";
const MUTE_FAINT = "text-muted-foreground/40";

/** One hairline for row separators, gap rows, section borders and rules. */
const HAIRLINE = "border-border/50";
const HAIRLINE_BG = "bg-border/50";

/** One step above the hairline; shared by both chip kinds. */
const CHIP_EDGE = "border-border/70";

/** One tracking value for every uppercase micro-label. */
const CAPS = "font-semibold tracking-[0.1em] uppercase";

/** Gold means "in flight or about to receive" — ghost, armed row, armed section. */
const ARMED = "bg-brand-gold-strong/15";

/* ------------------------------------------------------------- furniture -- */

/** The one piece of chrome that spans the full width. Pins under the app bar. */
function MonthBand({
  bandRef,
  label,
}: {
  bandRef?: RefObject<HTMLDivElement | null>;
  label: string;
}) {
  return (
    <div
      ref={bandRef}
      style={{ top: APP_BAR }}
      className="sticky z-10 -mx-1 flex items-center gap-2 bg-surface-1/95 px-1 pt-3 pb-1.5 backdrop-blur-sm"
    >
      <span className={cn("font-heading text-xs", CAPS, MUTE)}>{label}</span>
      <span aria-hidden className={cn("h-px flex-1", HAIRLINE_BG)} />
    </div>
  );
}

/**
 * The date rail: weekday over day number, with *identical* layout, type and
 * x-alignment on every rendered day — a quieter day changes only its tone.
 * Today is the one day whose 28px disc is filled.
 */
function DayRail({
  date,
  empty,
  isToday,
  isWeekend,
}: {
  date: Date;
  empty: boolean;
  isToday: boolean;
  isWeekend: boolean;
}) {
  /** One step down for a weekend, two for a day with nothing on it. */
  const dim = isToday ? "none" : empty ? "faint" : isWeekend ? "soft" : "none";

  return (
    <div className={cn(RAIL, "flex flex-col items-center gap-0.5 pt-1")}>
      <span
        className={cn(
          "text-2xs leading-none",
          CAPS,
          dim === "faint" ? MUTE_FAINT : dim === "soft" ? MUTE_SOFT : MUTE,
        )}
      >
        {format(date, "EEE")}
      </span>
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full text-sm leading-none font-semibold tabular-nums",
          isToday
            ? "bg-brand-accent-foreground text-surface-1"
            : dim === "faint"
              ? MUTE_FAINT
              : dim === "soft"
                ? MUTE_SOFT
                : "text-foreground",
        )}
      >
        {format(date, "d")}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ rows -- */

const NO_ITEMS: PlanItem[] = [];

/**
 * One calendar day: rail left, chips right. An empty day keeps its row, rail
 * and hairline so it stays a visible, fingertip-tall drop target. Today adds
 * a filled disc and one faint wash — nothing else.
 */
function DayRow({
  chrome,
  items = NO_ITEMS,
  offset,
  rowRef,
}: {
  chrome: ScheduleChrome;
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
    data: { slotKey: key } satisfies ScheduleSlotData,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (rowRef) rowRef.current = node;
      }}
      className={cn(
        "flex items-stretch rounded-md transition-colors",
        ROW_MIN,
        isToday && "bg-brand-accent-foreground/[0.05]",
        armed && ARMED,
      )}
    >
      <DayRail
        date={date}
        empty={empty}
        isToday={isToday}
        isWeekend={isWeekend}
      />

      <div
        className={cn(
          "min-w-0 flex-1 border-t pr-0.5 pl-1",
          armed ? "border-dashed border-brand-gold-strong/70" : HAIRLINE,
          !empty && "flex flex-col gap-1 py-1.5",
        )}
      >
        {items.map((item) => (
          <ScheduleChip
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

/**
 * A run of quiet days past the near horizon, as one line. Tapping it opens the
 * run into the same hairline day rows the near horizon prints, so a far-off
 * date is reachable without spending a screenful of list on it.
 */
function GapRow({
  chrome,
  from,
  onToggle,
  open,
  to,
}: {
  chrome: ScheduleChrome;
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
        className={cn(
          "flex items-center border-t border-dashed py-2 text-left",
          HAIRLINE,
        )}
      >
        <span
          aria-hidden
          className={cn(RAIL, "text-center text-2xs", MUTE_FAINT)}
        >
          ···
        </span>
        <span
          className={cn(
            "flex flex-1 items-center gap-1 pl-1 text-2xs",
            MUTE_SOFT,
          )}
        >
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
function WaitingSection({
  chrome,
  items,
}: {
  chrome: ScheduleChrome;
  items: PlanItem[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "slot::overdue",
    data: { slotKey: "overdue" } satisfies ScheduleSlotData,
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
        <span
          className={cn("font-heading text-xs text-condition-attention", CAPS)}
        >
          Waiting
        </span>
        <span aria-hidden className="h-px flex-1 bg-condition-attention/25" />
        <span className="text-2xs font-semibold tabular-nums text-condition-attention">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-1.5 pb-2">
        {items.map((item) => (
          <ScheduleChip
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
  chrome: ScheduleChrome;
  items: PlanItem[];
  onToggle: () => void;
  open: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "slot::none",
    data: { slotKey: "none" } satisfies ScheduleSlotData,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-2 rounded-xl border transition-colors",
        armed ? cn("border-brand-gold-strong/50", ARMED) : HAIRLINE,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <span className={cn("font-heading text-xs", CAPS, MUTE)}>No date</span>
        <span
          className={cn(
            "rounded-full bg-surface-3 px-1.5 text-2xs font-semibold tabular-nums",
            MUTE,
          )}
        >
          {items.length}
        </span>
        <span aria-hidden className={cn("h-px flex-1", HAIRLINE_BG)} />
        {open ? (
          <ChevronUp className={cn("size-3.5", MUTE_SOFT)} />
        ) : (
          <ChevronDown className={cn("size-3.5", MUTE_SOFT)} />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-1 px-1.5 pb-2">
          {items.length === 0 ? (
            <p className={cn("py-1 pl-1 text-xs", MUTE_FAINT)}>
              Everything has a day
            </p>
          ) : (
            items.map((item) => (
              <ScheduleChip
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

/* ------------------------------------------------------------------ chip -- */

/**
 * Presentation only, so the lifted ghost is identical to the row it left. The
 * chip *is* the Area label: a condition rail down its left edge and the
 * Area's icon in a condition-toned pill. An inbox Task wears a dashed pill and
 * the Inbox glyph.
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
        "relative flex w-full items-start gap-2 overflow-hidden rounded-lg border py-2 pr-2.5 pl-3 text-left",
        isTask
          ? cn("border-dashed bg-surface-2/60", CHIP_EDGE)
          : cn("bg-surface-2", CHIP_EDGE),
        waiting && "border-condition-attention/30 bg-condition-attention/8",
        // The lifted ghost wears the same gold the armed row does, so what is in
        // flight and where it would land read as one gesture.
        lifted &&
          "border-transparent bg-surface-2 shadow-lg ring-1 ring-brand-gold-strong/50",
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
            ? cn("border border-dashed bg-surface-2", CHIP_EDGE, MUTE)
            : conditionIconTone[area?.condition ?? "healthy"],
        )}
      >
        {isTask ? (
          <Inbox aria-hidden className="size-3" />
        ) : area ? (
          <AreaIcon icon={area.icon} className="size-3.5" />
        ) : (
          <Compass aria-hidden className="size-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "line-clamp-2 text-sm leading-snug",
            isTask ? "font-normal" : "font-medium",
          )}
        >
          {item.title}
        </span>

        <span
          className={cn(
            "mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-snug",
            MUTE_SOFT,
          )}
        >
          {ConditionIcon && area && area.condition !== "healthy" && (
            <ConditionIcon
              aria-hidden
              className={cn("size-3", conditionTextClassName[area.condition])}
            />
          )}
          <span className="truncate">{area?.name ?? "Inbox"}</span>
          {item.nextMove && (
            <>
              <span aria-hidden>·</span>
              <CornerDownRight aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{item.nextMove}</span>
            </>
          )}
        </span>
      </span>

      {waiting && (
        <span className="mt-px shrink-0 text-2xs font-semibold tabular-nums text-condition-attention">
          {waitingLabel(item.date!, now)}
        </span>
      )}
    </div>
  );
}

/**
 * A chip sitting on its day.
 *
 * Tapping opens the Thread rail in place; a Task chip goes to the Inbox, the
 * only place a Task can be edited. Dragging arms on a touch long-press, so a
 * tap and a lift never fight each other.
 */
function ScheduleChip({
  chrome,
  item,
  slotKey,
}: {
  chrome: ScheduleChrome;
  item: PlanItem;
  slotKey: string;
}) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: item.id,
    data: {
      itemId: item.id,
      kind: item.kind,
      slotKey,
    } satisfies ScheduleDragData,
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
