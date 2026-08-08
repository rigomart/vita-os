// PROTOTYPE — throwaway (issue #268). Variant A: transposed grid — time vertical, area columns horizontal.

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
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { Ban, ChevronDown, ChevronRight, CornerDownRight } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import type { SlotDropData } from "@/features/dashboard/plan/plan-axis";
import type { ChipDragData } from "@/features/dashboard/plan/plan-chip";
import type {
  DaySlot,
  DragState,
  Lane,
  PlanItem,
} from "@/features/dashboard/plan/plan-model";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { ChipSurface, PlanChip } from "@/features/dashboard/plan/plan-chip";
import {
  buildAxis,
  buildLanes,
  buildPlanItems,
  conditionIconTone,
  conditionLaneTint,
  conditionShort,
  dayAt,
  INBOX_LANE_ID,
  planDrop,
  slotTotals,
} from "@/features/dashboard/plan/plan-model";

/** Slim pinned day ruler down the left edge. */
const GUTTER = 48;
/** ~2 Area columns visible beside the gutter at 390px. */
const COLUMN = 160;

/** Where a drop lands, held locally — the prototype writes nothing through. */
interface LocalMove {
  /** A day key (`d3`) or `none`. */
  dayKey: string;
  laneId: string;
}

interface Chrome {
  drag: DragState | null;
  now: number;
}

/**
 * Plan, transposed for the phone.
 *
 * Time runs **down** — the direction a phone already scrolls — and Areas become
 * columns you swipe sideways through. The day ruler pins left at 48px, the Area
 * headers pin top; the whole board is one 2D scroll pane, so nothing but the
 * ruler and the headers is spent on furniture.
 *
 * The axis still compresses: a day nothing sits on (and that is not today)
 * shrinks to a tick *row*. Overdue work sits in a tinted band above today
 * instead of a pinned bay, and No date collapses into a band at the bottom.
 */
export function PlanVariantTransposed({
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

  const [drag, setDrag] = useState<DragState | null>(null);
  const [moves, setMoves] = useState<ReadonlyMap<string, LocalMove>>(new Map());
  const [showNone, setShowNone] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  const base = useMemo(() => buildPlanItems(threads, tasks), [threads, tasks]);

  /** Local moves are folded into the model before anything is laid out. */
  const items = useMemo(
    () =>
      base.map((item): PlanItem => {
        const move = moves.get(item.id);
        if (!move) return item;
        return {
          ...item,
          ...(item.kind === "thread" &&
            move.laneId !== INBOX_LANE_ID && { areaId: move.laneId }),
          date:
            move.dayKey === "none"
              ? undefined
              : dayAt(Number(move.dayKey.slice(1)), now),
        };
      }),
    [base, moves, now],
  );

  const axis = useMemo(
    () => buildAxis(items, now, "compact", GUTTER),
    [items, now],
  );

  const horizon = axis.days.length - 1;
  const { areaLanes, inbox } = useMemo(
    () => buildLanes(items, areas, now, horizon),
    [items, areas, now, horizon],
  );

  const lanes = useMemo(() => [...areaLanes, inbox], [areaLanes, inbox]);
  const totals = useMemo(() => slotTotals(lanes), [lanes]);

  const chrome: Chrome = { drag, now };

  /* ------------------------------------------------------------- drag -- */

  function areaName(laneId: string): string {
    if (laneId === INBOX_LANE_ID) return "Inbox";
    return areas.find((area) => area.id === laneId)?.name ?? "another Area";
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ChipDragData | undefined;
    if (!data) return;
    setDrag({
      itemId: data.itemId,
      kind: data.kind,
      laneId: data.laneId,
      slotKey: data.slotKey,
    });
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.data.current as SlotDropData | undefined;
    setDrag((previous) =>
      previous
        ? {
            ...previous,
            overLaneId: over ? (over.laneId ?? previous.laneId) : undefined,
            overSlotKey: over?.slotKey,
          }
        : previous,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDrag(null);

    const source = event.active.data.current as ChipDragData | undefined;
    const over = event.over?.data.current as SlotDropData | undefined;
    if (!source || !over) return;

    const plan = planDrop(
      {
        itemId: source.itemId,
        kind: source.kind,
        laneId: source.laneId,
        overLaneId: over.laneId ?? source.laneId,
        overSlotKey: over.slotKey,
        slotKey: source.slotKey,
      },
      axis,
      areaName,
    );
    if (!plan?.valid) return;

    setMoves((previous) => {
      const next = new Map(previous);
      next.set(source.itemId, { dayKey: plan.slotKey, laneId: plan.laneId });
      return next;
    });
    if (plan.slotKey === "none") setShowNone(true);
  }

  const draggingItem = drag && items.find((item) => item.id === drag.itemId);
  const dropPlan = drag ? planDrop(drag, axis, areaName) : null;

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-1.5 px-0.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "tabular-nums",
            totals.overdue > 0 && "font-medium text-condition-attention",
          )}
        >
          {totals.overdue} waiting
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          {totals.byDay.get(axis.days[0]?.key ?? "") ?? 0} today
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{totals.none} undated</span>
      </p>

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
              "Drag down the column to pick an exact day, or sideways into another Area column to move the Thread.",
          },
        }}
      >
        <div className="h-[68dvh] min-h-80 overflow-auto overscroll-contain rounded-xl border border-border bg-surface-1 [scrollbar-width:thin]">
          <div
            className="grid w-max"
            style={{
              gridTemplateColumns: `${GUTTER}px repeat(${lanes.length}, ${COLUMN}px)`,
            }}
          >
            {/* corner: pinned in both directions */}
            <div className="sticky top-0 left-0 z-40 flex items-end justify-center border-r border-b border-border bg-surface-1 px-1 pt-2 pb-1.5">
              <span className="text-[9px] font-semibold tracking-[0.08em] text-muted-foreground/60 uppercase">
                {format(new Date(now), "MMM")}
              </span>
            </div>

            {lanes.map((lane) => (
              <ColumnHeader key={lane.id} drag={drag} lane={lane} />
            ))}

            {axis.hasOverdue && <WaitingBand chrome={chrome} lanes={lanes} />}

            {axis.days.map((day) => (
              <DayRow key={day.key} chrome={chrome} day={day} lanes={lanes} />
            ))}

            <NoDateBand
              chrome={chrome}
              count={totals.none}
              lanes={lanes}
              open={showNone}
              onToggle={() => setShowNone((previous) => !previous)}
            />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingItem && drag && (
            <div style={{ width: COLUMN - 12 }} className="cursor-grabbing">
              <ChipSurface
                density="compact"
                item={draggingItem}
                lifted
                now={now}
                slotKey={drag.slotKey}
              />
              {dropPlan && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex max-w-[13rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                    dropPlan.tone === "move" && "bg-foreground text-surface-1",
                    dropPlan.tone === "default" &&
                      "bg-surface-2 text-foreground ring-1 ring-border",
                    dropPlan.tone === "blocked" &&
                      "bg-surface-2 text-muted-foreground/70 ring-1 ring-border/60",
                  )}
                >
                  {dropPlan.tone === "blocked" ? (
                    <Ban className="size-2.5 shrink-0" />
                  ) : (
                    <CornerDownRight className="size-2.5 shrink-0" />
                  )}
                  {dropPlan.caption}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

/* --------------------------------------------------------------- header -- */

/** A compact sticky column head: icon pill, short name, condition tint. */
function ColumnHeader({ drag, lane }: { drag: DragState | null; lane: Lane }) {
  const isInbox = lane.id === INBOX_LANE_ID;
  const area = lane.area;
  const incoming =
    drag != null &&
    drag.kind === "thread" &&
    !isInbox &&
    drag.overLaneId === lane.id &&
    drag.laneId !== lane.id;

  const ConditionIcon = area ? conditionIcons[area.condition] : null;

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex items-center gap-1.5 border-b border-l border-border bg-surface-1 px-2 py-1.5",
        incoming && "ring-1 ring-foreground/35 ring-inset",
      )}
    >
      {area && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            conditionLaneTint[area.condition],
          )}
        />
      )}

      <span
        className={cn(
          "relative flex size-6 shrink-0 items-center justify-center rounded-md",
          area
            ? conditionIconTone[area.condition]
            : "border border-dashed border-border bg-surface-2 text-muted-foreground",
        )}
      >
        {area ? (
          <AreaIcon icon={area.icon} className="size-3" />
        ) : (
          <CornerDownRight className="size-3" />
        )}
      </span>

      <span className="relative min-w-0 flex-1 truncate font-heading text-[11px] leading-tight font-semibold tracking-tight">
        {area ? area.name : "Inbox"}
      </span>

      {ConditionIcon && area && area.condition !== "healthy" && (
        <ConditionIcon
          aria-label={conditionShort[area.condition]}
          className={cn(
            "relative size-3 shrink-0",
            conditionTextClassName[area.condition],
          )}
        />
      )}
      <span className="relative shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
        {lane.openCount}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- day rows -- */

function DayRow({
  chrome,
  day,
  lanes,
}: {
  chrome: Chrome;
  day: DaySlot;
  lanes: Lane[];
}) {
  const active = chrome.drag?.overSlotKey === day.key;
  const date = new Date(day.at);

  const rule = day.isToday
    ? "border-t-2 border-brand-accent-foreground/70"
    : day.isWeekStart
      ? "border-t border-border/45"
      : "border-t border-border/25";

  return (
    <>
      <div
        className={cn(
          "sticky left-0 z-20 flex flex-col items-center justify-center border-r border-border bg-surface-1",
          rule,
          day.wide ? "min-h-11 py-1" : "h-5",
          day.isWeekend && !day.isToday && "bg-foreground/[0.03]",
          day.isToday && "bg-surface-3/70",
          active && "bg-brand-gold-strong/15",
        )}
      >
        {day.wide ? (
          <>
            <span
              className={cn(
                "text-[9px] font-semibold tracking-[0.06em] uppercase",
                day.isToday
                  ? "text-brand-accent-foreground"
                  : "text-muted-foreground/70",
              )}
            >
              {day.isToday ? "Today" : format(date, "EEE")}
            </span>
            <span
              className={cn(
                "text-xs leading-tight font-semibold tabular-nums",
                day.isToday ? "text-foreground" : "text-foreground/70",
              )}
            >
              {format(date, "d")}
            </span>
            {day.isMonthStart && (
              <span className="text-[8px] font-semibold tracking-[0.06em] text-muted-foreground/50 uppercase">
                {format(date, "MMM")}
              </span>
            )}
          </>
        ) : (
          <span className="text-[9px] leading-none tabular-nums text-muted-foreground/45">
            {day.isMonthStart ? format(date, "d MMM") : format(date, "d")}
          </span>
        )}
      </div>

      {lanes.map((lane) => (
        <DayCell
          key={lane.id}
          chrome={chrome}
          day={day}
          items={lane.byDay.get(day.key)}
          laneId={lane.id}
          rule={rule}
        />
      ))}
    </>
  );
}

const EMPTY: PlanItem[] = [];

function DayCell({
  chrome,
  day,
  items = EMPTY,
  laneId,
  rule,
}: {
  chrome: Chrome;
  day: DaySlot;
  items?: PlanItem[];
  laneId: string;
  rule: string;
}) {
  const { drag, now } = chrome;

  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::${day.key}`,
    data: { laneId, slotKey: day.key } satisfies SlotDropData,
  });

  const rowActive = drag?.overSlotKey === day.key;
  const armed = drag != null && isOver && acceptsKind(laneId, drag.kind);

  return (
    <div
      ref={setNodeRef}
      data-slot-key={`${laneId}::${day.key}`}
      className={cn(
        "relative flex flex-col justify-center gap-1 border-l border-border/40 px-1.5 transition-colors",
        rule,
        day.wide ? "min-h-11 py-1" : "h-5",
        day.isWeekend && !day.isToday && "bg-foreground/[0.03]",
        day.isToday && "bg-surface-3/40",
        rowActive && "bg-brand-gold-strong/10",
        armed && "bg-brand-gold-strong/20",
      )}
    >
      {armed && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0.5 inset-y-0.5 rounded-md border border-dashed border-foreground/40"
        />
      )}

      {items.map((item) => (
        <PlanChip
          key={item.id}
          density="compact"
          item={item}
          laneId={laneId}
          now={now}
          onOpen={noop}
          slotKey={day.key}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- bands -- */

/** The debt band, above today rather than pinned to a side bay. */
function WaitingBand({ chrome, lanes }: { chrome: Chrome; lanes: Lane[] }) {
  return (
    <>
      <div className="sticky left-0 z-20 flex flex-col items-center justify-center border-r border-border bg-condition-attention/[0.09] py-1">
        <span className="text-[9px] leading-tight font-semibold tracking-[0.06em] text-condition-attention uppercase">
          Wait
        </span>
      </div>

      {lanes.map((lane) => (
        <BandCell
          key={lane.id}
          chrome={chrome}
          items={lane.overdue}
          laneId={lane.id}
          slotKey="overdue"
        />
      ))}
    </>
  );
}

/** No date: a collapsed band at the foot of the board, opened on demand. */
function NoDateBand({
  chrome,
  count,
  lanes,
  onToggle,
  open,
}: {
  chrome: Chrome;
  count: number;
  lanes: Lane[];
  onToggle: () => void;
  open: boolean;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <>
      <div
        className="border-t border-border bg-surface-2/60"
        style={{ gridColumn: "1 / -1" }}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="sticky left-0 flex h-8 items-center gap-1.5 px-2 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
        >
          <Chevron className="size-3.5 shrink-0" />
          No date
          <span className="tracking-normal tabular-nums text-muted-foreground/70">
            {count}
          </span>
        </button>
      </div>

      {open && (
        <>
          <div className="sticky left-0 z-20 border-t border-border/40 border-r bg-surface-1" />
          {lanes.map((lane) => (
            <BandCell
              key={lane.id}
              chrome={chrome}
              items={lane.none}
              laneId={lane.id}
              slotKey="none"
            />
          ))}
        </>
      )}
    </>
  );
}

function BandCell({
  chrome,
  items,
  laneId,
  slotKey,
}: {
  chrome: Chrome;
  items: PlanItem[];
  laneId: string;
  slotKey: "none" | "overdue";
}) {
  const { drag, now } = chrome;
  const waiting = slotKey === "overdue";

  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::${slotKey}`,
    data: { laneId, slotKey } satisfies SlotDropData,
  });

  const armed = drag != null && isOver && acceptsKind(laneId, drag.kind);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-11 flex-col justify-center gap-1 border-l border-border/40 px-1.5 py-1",
        waiting
          ? "bg-condition-attention/[0.07]"
          : "border-t border-border/40 bg-surface-1",
        armed && !waiting && "bg-surface-3",
      )}
    >
      {items.map((item) => (
        <PlanChip
          key={item.id}
          density="compact"
          item={item}
          laneId={laneId}
          now={now}
          onOpen={noop}
          slotKey={slotKey}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ misc -- */

function acceptsKind(laneId: string, kind: PlanItem["kind"]): boolean {
  return kind === "task" ? laneId === INBOX_LANE_ID : laneId !== INBOX_LANE_ID;
}

/** The prototype has no Thread rail to open into. */
function noop() {}
