// PROTOTYPE — throwaway (issue #268). Variant C: one-lane pager — one area at a time, time vertical, swipe/tab between areas.
//
// Known limitations, on purpose:
// - Drops write to LOCAL state only (a Map of itemId → slotKey applied before
//   `buildLanes`). No mutations, so nothing survives a reload.
// - Cross-area moves are out of scope: only the visible lane is mounted, so a
//   chip can only be re-dated inside its own Area.
// - The Waiting band is a droppable but rejects drops — the past is not a plan.

import type { Condition } from "@convex/lib/condition";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

import type { SlotDropData } from "../plan/plan-axis";
import type { ChipDragData } from "../plan/plan-chip";
import type { Lane, PlanItem } from "../plan/plan-model";

import { ChipSurface, PlanChip } from "../plan/plan-chip";
import {
  buildLanes,
  buildPlanItems,
  conditionIconTone,
  conditionLaneTint,
  conditionShort,
  dayAt,
  dayKey,
  INBOX_LANE_ID,
} from "../plan/plan-model";

/** How far ahead the vertical agenda runs. Fixed — no compressing axis here. */
const HORIZON = 27;

/** Swipe has to be this decisive before it turns the page. */
const SWIPE_PX = 56;

/** A dot on the area pill, so condition survives the icon-only collapse. */
const conditionDot: Record<Condition, string> = {
  critical: "bg-condition-critical",
  needs_attention: "bg-condition-attention",
  healthy: "bg-condition-healthy/45",
};

interface PagerDrag {
  itemId: string;
  slotKey: string;
}

interface DayRow {
  at: number;
  isMonthStart: boolean;
  isToday: boolean;
  isWeekend: boolean;
  key: string;
  offset: number;
}

/**
 * Plan on a phone, as a pager.
 *
 * The desktop canvas spends its width on pinned furniture — a lane header
 * column, a Waiting bay, a pinned No-date bay — which on a 390px screen leaves
 * almost nothing for the work itself. So this variant drops the second
 * dimension: exactly one Area is on screen at a time, full width, with time
 * running *down* instead of across. Switching Areas is a tab or a swipe.
 */
export function PlanVariantPager({
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

  /** itemId → slot it was dropped on ("d3" or "none"). Prototype-local. */
  const [moves, setMoves] = useState<ReadonlyMap<string, string>>(new Map());
  const [drag, setDrag] = useState<PagerDrag | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [noDateOpen, setNoDateOpen] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Long-press to lift, so a horizontal swipe pages and a vertical one
    // scrolls — neither ever steals a chip.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  /** The one place local drops are applied: rewrite the date, then rebuild. */
  const items = useMemo(() => {
    const base = buildPlanItems(threads, tasks);
    if (moves.size === 0) return base;
    return base.map((item): PlanItem => {
      const slot = moves.get(item.id);
      if (slot == null) return item;
      if (slot === "none") return { ...item, date: undefined };
      return { ...item, date: dayAt(Number(slot.slice(1)), now) };
    });
  }, [threads, tasks, moves, now]);

  const { areaLanes, inbox } = useMemo(
    () => buildLanes(items, areas, now, HORIZON),
    [items, areas, now],
  );

  const lanes = useMemo(() => [...areaLanes, inbox], [areaLanes, inbox]);
  const index = Math.max(
    0,
    lanes.findIndex((entry) => entry.id === activeId),
  );
  const lane = lanes[index];

  const days = useMemo(() => buildDays(now), [now]);

  /* ------------------------------------------------------------- paging -- */

  function step(delta: number) {
    const next = lanes[index + delta];
    if (next) setActiveId(next.id);
  }

  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stripRef.current
      ?.querySelector(`[data-pill="${CSS.escape(lane.id)}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
  }, [lane.id]);

  const touch = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(event: React.TouchEvent) {
    const point = event.touches[0];
    touch.current = { x: point.clientX, y: point.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    // A lifted chip owns the gesture; paging mid-drag would drop the target.
    if (!start || drag) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  }

  /* --------------------------------------------------------------- drag -- */

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ChipDragData | undefined;
    if (!data) return;
    setDrag({ itemId: data.itemId, slotKey: data.slotKey });
  }

  function handleDragEnd(event: DragEndEvent) {
    setDrag(null);
    const source = event.active.data.current as ChipDragData | undefined;
    const over = event.over?.data.current as SlotDropData | undefined;
    if (!source || !over) return;
    if (over.slotKey === "overdue") return;
    if (over.slotKey === source.slotKey) return;

    setMoves((previous) => {
      const next = new Map(previous);
      next.set(source.itemId, over.slotKey);
      return next;
    });
  }

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

  const draggingItem = drag && items.find((item) => item.id === drag.itemId);
  const noDateExpanded = noDateOpen || drag != null;

  /* ------------------------------------------------------------- render -- */

  return (
    <section aria-label="Plan" className="flex flex-col">
      <DndContext
        collisionDetection={pointerWithin}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDrag(null)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Drag down the agenda to pick an exact day, or onto No date to clear it. Press Enter to open it instead.",
          },
        }}
      >
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Areas"
          className="sticky top-0 z-30 -mx-1 flex gap-1.5 overflow-x-auto bg-surface-1/95 px-1 py-2 backdrop-blur [scrollbar-width:none]"
        >
          {lanes.map((entry) => (
            <AreaPill
              key={entry.id}
              active={entry.id === lane.id}
              lane={entry}
              onSelect={() => setActiveId(entry.id)}
            />
          ))}
        </div>

        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <LaneHeader
            lane={lane}
            position={`${index + 1} of ${lanes.length}`}
          />

          <WaitingBand
            dragging={drag != null}
            lane={lane}
            now={now}
            onOpen={openItem}
          />

          <ol className="mt-1">
            {days.map((day) => (
              <DayRowCell
                key={day.key}
                day={day}
                items={lane.byDay.get(day.key)}
                laneId={lane.id}
                now={now}
                onOpen={openItem}
              />
            ))}
          </ol>

          <NoDateBand
            expanded={noDateExpanded}
            lane={lane}
            now={now}
            onOpen={openItem}
            onToggle={() => setNoDateOpen((open) => !open)}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingItem && drag && (
            <div className="w-[min(88vw,22rem)] cursor-grabbing">
              <ChipSurface
                density="comfortable"
                item={draggingItem}
                lifted
                now={now}
                slotKey={drag.slotKey}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

/* ------------------------------------------------------------------ strip -- */

/** Icon plus a condition dot; only the active pill spends width on a name. */
function AreaPill({
  active,
  lane,
  onSelect,
}: {
  active: boolean;
  lane: Lane;
  onSelect: () => void;
}) {
  const isInbox = lane.id === INBOX_LANE_ID;
  const condition = lane.area?.condition ?? "healthy";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-pill={lane.id}
      onClick={onSelect}
      className={cn(
        "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 ring-1 transition-colors",
        active
          ? "bg-surface-2 text-foreground ring-border"
          : "bg-transparent text-muted-foreground ring-border/40",
      )}
    >
      <span className="relative flex size-5 items-center justify-center">
        {isInbox ? (
          <Inbox className="size-4" />
        ) : (
          <AreaIcon icon={lane.area?.icon} className="size-4" />
        )}
        {!isInbox && (
          <span
            aria-hidden
            className={cn(
              "absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-2 ring-surface-1",
              conditionDot[condition],
            )}
          />
        )}
      </span>

      {active && (
        <span className="max-w-[9rem] truncate text-xs font-medium">
          {isInbox ? "Inbox" : lane.area?.name}
        </span>
      )}
      <span
        className={cn(
          "text-[11px] tabular-nums",
          active ? "text-muted-foreground" : "text-muted-foreground/50",
        )}
      >
        {lane.openCount}
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------- header -- */

/** The desktop lane header, unstacked: it owns the full width here. */
function LaneHeader({ lane, position }: { lane: Lane; position: string }) {
  const isInbox = lane.id === INBOX_LANE_ID;
  const area = lane.area;
  const condition = area?.condition ?? "healthy";
  const ConditionIcon = conditionIcons[condition];

  return (
    <header
      className={cn(
        "relative flex items-start gap-2.5 rounded-lg px-2.5 py-2.5",
        !isInbox && conditionLaneTint[condition],
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          isInbox
            ? "border border-dashed border-border bg-surface-2 text-muted-foreground"
            : conditionIconTone[condition],
        )}
      >
        {isInbox ? (
          <Inbox className="size-4" />
        ) : (
          <AreaIcon icon={area?.icon} className="size-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate font-heading text-base font-semibold tracking-tight">
            {isInbox ? "Inbox" : area?.name}
          </h2>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
            {position}
          </span>
        </div>

        {isInbox ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground/60">
            Tasks · no Area
          </span>
        ) : (
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px]">
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 font-medium",
                conditionTextClassName[condition],
              )}
            >
              <ConditionIcon aria-hidden className="size-3" />
              {conditionShort[condition]}
            </span>
            <span className="truncate text-muted-foreground/60">
              · {laneDetail(lane)}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}

function laneDetail(lane: Lane): string {
  if (lane.openCount === 0) return "No open Threads";
  if (lane.plannedCount === 0) return "Nothing planned";
  if (lane.nearHorizon === 0) return "Nothing this week";
  return `${lane.plannedCount} planned`;
}

/* ------------------------------------------------------------------ bands -- */

/** Overdue, on top where it cannot be scrolled past. Never accepts a drop. */
function WaitingBand({
  dragging,
  lane,
  now,
  onOpen,
}: {
  dragging: boolean;
  lane: Lane;
  now: number;
  onOpen: (item: PlanItem) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${lane.id}::overdue`,
    data: { laneId: lane.id, slotKey: "overdue" } satisfies SlotDropData,
  });

  if (lane.overdue.length === 0) return null;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "mt-1 rounded-lg bg-condition-attention/[0.07] px-2 py-2",
        dragging && isOver && "ring-1 ring-condition-attention/30 ring-inset",
      )}
    >
      <div className="flex items-baseline gap-1 px-0.5 pb-1.5">
        <span className="text-[10px] font-semibold tracking-[0.08em] text-condition-attention uppercase">
          Waiting
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-condition-attention/80">
          {lane.overdue.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {lane.overdue.map((item) => (
          <PlanChip
            key={item.id}
            density="comfortable"
            item={item}
            laneId={lane.id}
            now={now}
            onOpen={onOpen}
            slotKey="overdue"
          />
        ))}
      </div>
    </section>
  );
}

/** The bottom of the agenda: undated work, folded away behind its count. */
function NoDateBand({
  expanded,
  lane,
  now,
  onOpen,
  onToggle,
}: {
  expanded: boolean;
  lane: Lane;
  now: number;
  onOpen: (item: PlanItem) => void;
  onToggle: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${lane.id}::none`,
    data: { laneId: lane.id, slotKey: "none" } satisfies SlotDropData,
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "mt-2 rounded-lg border border-border/70 bg-surface-2/40 p-1.5",
        isOver && "border-dashed border-foreground/40 bg-surface-3",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground/70" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground/70" />
        )}
        <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
          No date
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/70">
          {lane.none.length}
        </span>
      </button>

      {expanded && lane.none.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          {lane.none.map((item) => (
            <PlanChip
              key={item.id}
              density="comfortable"
              item={item}
              laneId={lane.id}
              now={now}
              onOpen={onOpen}
              slotKey="none"
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- days -- */

function buildDays(now: number): DayRow[] {
  const rows: DayRow[] = [];
  for (let offset = 0; offset <= HORIZON; offset += 1) {
    const at = dayAt(offset, now);
    const date = new Date(at);
    const weekday = date.getDay();
    rows.push({
      at,
      isMonthStart: date.getDate() === 1,
      isToday: offset === 0,
      isWeekend: weekday === 0 || weekday === 6,
      key: dayKey(offset),
      offset,
    });
  }
  return rows;
}

const EMPTY: PlanItem[] = [];

/**
 * One day, running down the page.
 *
 * A day holding work opens to a full row; an empty one collapses to a tick —
 * still a legible date, still a drop target, but a fortnight of them costs a
 * couple of hundred pixels instead of a couple of thousand.
 */
function DayRowCell({
  day,
  items = EMPTY,
  laneId,
  now,
  onOpen,
}: {
  day: DayRow;
  items?: PlanItem[];
  laneId: string;
  now: number;
  onOpen: (item: PlanItem) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::${day.key}`,
    data: { laneId, slotKey: day.key } satisfies SlotDropData,
  });

  const date = new Date(day.at);
  const open = items.length > 0 || day.isToday;

  return (
    <li
      ref={setNodeRef}
      data-day={day.key}
      className={cn(
        "relative grid grid-cols-[3.25rem_1fr] items-start gap-2 border-t border-border/25 pr-0.5 transition-colors",
        open ? "py-1.5" : "py-1",
        day.isWeekend && "bg-foreground/[0.03]",
        day.isToday &&
          "rounded-r-md border-t-0 bg-surface-3/70 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-brand-accent-foreground before:content-['']",
        isOver && "bg-brand-gold-strong/20",
      )}
    >
      <span
        className={cn(
          "flex items-baseline gap-1 pl-2.5",
          open ? "pt-1" : "pt-px",
        )}
      >
        <span
          className={cn(
            "text-[10px] font-semibold tracking-[0.06em] uppercase",
            day.isToday
              ? "text-brand-accent-foreground"
              : day.isWeekend
                ? "text-muted-foreground/45"
                : "text-muted-foreground/70",
          )}
        >
          {day.isToday ? "Today" : format(date, "EEE")}
        </span>
        {!day.isToday && (
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              open ? "text-foreground/80" : "text-muted-foreground/45",
            )}
          >
            {day.isMonthStart ? format(date, "d MMM") : format(date, "d")}
          </span>
        )}
      </span>

      {items.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-1">
          {items.map((item) => (
            <PlanChip
              key={item.id}
              density="comfortable"
              item={item}
              laneId={laneId}
              now={now}
              onOpen={onOpen}
              slotKey={day.key}
            />
          ))}
        </div>
      ) : (
        <span
          aria-hidden
          className={cn(
            "mt-2 h-px w-full rounded-full",
            isOver ? "bg-foreground/40" : "bg-border/40",
          )}
        />
      )}
    </li>
  );
}
