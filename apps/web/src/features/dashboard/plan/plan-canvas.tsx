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
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { Ban, CornerDownRight, Rows2, Rows4 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";

import { useInboxSurface } from "@/features/inbox/surface/use-inbox-surface";
import { useIsMobile } from "@/hooks/use-mobile";

import type { SlotDropData } from "./plan-axis";
import type { ChipDragData } from "./plan-chip";
import type { Density, DragState, PlanItem, PlanItemKind } from "./plan-model";
import type { PlanActions } from "./use-plan-actions";

import { AxisHeader } from "./plan-axis";
import { ChipSurface } from "./plan-chip";
import { AreaFilterChips } from "./plan-filters";
import { LaneRow, NoDateBucket } from "./plan-lane";
import { PlanLaterDialog } from "./plan-later-dialog";
import {
  bayWidth,
  buildAxis,
  buildLanes,
  buildPlanItems,
  HEADER_WIDTH,
  HEADER_WIDTH_NARROW,
  INBOX_LANE_ID,
  planDrop,
  slotTotals,
} from "./plan-model";
import { PlanScrollbar, useScrollMetrics } from "./plan-scrollbar";

const DENSITY_OPTIONS: {
  icon: typeof Rows2;
  label: string;
  value: Density;
}[] = [
  { icon: Rows2, label: "Comfortable", value: "comfortable" },
  { icon: Rows4, label: "Compact", value: "compact" },
];

/**
 * A drop on the Later bay, waiting on the day the calendar has yet to name.
 * Nothing is written until it is picked, so an abandoned dialog leaves the item
 * exactly where it was — Area move included.
 */
interface PendingLater {
  /** The Area the drop would move a Thread into, when it crossed lanes. */
  areaMove?: string;
  /** The item's current date, so the calendar opens where the item already is. */
  at?: number;
  itemId: string;
  kind: PlanItemKind;
}

/**
 * Plan — the Area × day canvas. One shared compressing day ruler; every Area is
 * a band beneath it, every chip on its exact calendar day.
 *
 * Dragging along a lane retargets the day, across lanes moves the Thread's
 * Area, up onto the ruler retargets the day without leaving the lane. Every
 * drop writes straight through the app's own mutations — no staged state, and
 * dragging back is the undo. Opening a chip opens the Thread rail via
 * `?thread=<slug>`.
 */
export function PlanCanvas({
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
  const inboxSurface = useInboxSurface();
  const { planTask, planThread } = planActions;

  const [density, setDensity] = useState<Density>("comfortable");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingLater, setPendingLater] = useState<PendingLater | null>(null);
  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );

  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null);
  const metrics = useScrollMetrics(scrollNode);

  /**
   * Mouse and touch each get their own guard: a mouse drag arms after 5px so a
   * plain click still opens the chip, a touch drag arms only on a long-press
   * so panning the canvas never lifts a chip. No KeyboardSensor on purpose —
   * it claims Enter/Space on every draggable, which would stop the keyboard
   * from opening the Thread rail, the more valuable affordance here.
   */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  const items = useMemo(() => buildPlanItems(threads, tasks), [threads, tasks]);

  /** Only what is on screen shapes the axis: hiding an Area collapses its days. */
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.kind === "task" ||
          activeAreas == null ||
          (item.areaId != null && activeAreas.has(item.areaId)),
      ),
    [items, activeAreas],
  );

  const narrow = useIsMobile();
  const headerWidth = narrow ? HEADER_WIDTH_NARROW : HEADER_WIDTH;

  const axis = useMemo(
    () => buildAxis(visibleItems, now, density, headerWidth),
    [visibleItems, now, density, headerWidth],
  );

  const horizon = axis.days.length - 1;
  const { areaLanes, inbox } = useMemo(
    () => buildLanes(items, areas, now, horizon),
    [items, areas, now, horizon],
  );

  const lanes = useMemo(
    () =>
      activeAreas == null
        ? areaLanes
        : areaLanes.filter((lane) => activeAreas.has(lane.id)),
    [areaLanes, activeAreas],
  );

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lane of areaLanes) counts.set(lane.id, lane.openCount);
    return counts;
  }, [areaLanes]);

  /**
   * One pass over the lanes actually on screen, feeding both the summary line
   * and every count in the axis header — so the two can never disagree.
   */
  const totals = useMemo(() => slotTotals([...lanes, inbox]), [lanes, inbox]);

  const tally = useMemo(
    () => ({
      inbox: inbox.openCount,
      open:
        lanes.reduce((sum, lane) => sum + lane.openCount, 0) + inbox.openCount,
      overdue: totals.overdue,
      today: totals.byDay.get(axis.days[0]?.key ?? "") ?? 0,
      undated: totals.none,
    }),
    [lanes, inbox, totals, axis.days],
  );

  /** How much of the right edge the pinned Later bay holds. */
  const pinnedRight = bayWidth(density);

  const edges = {
    end: metrics.scrollLeft + metrics.clientWidth < metrics.scrollWidth - 4,
    start: metrics.scrollLeft > 4,
  };

  function openItem(item: PlanItem) {
    // Tasks have no rail of their own; the Inbox is where a Task is handled.
    if (item.kind === "task") {
      inboxSurface.open();
      return;
    }
    if (item.slug == null) return;
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, thread: item.slug }),
    });
  }

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
            // The ruler has no lane of its own: it retargets the day and
            // leaves the Thread where it is.
            overLaneId: over ? (over.laneId ?? previous.laneId) : undefined,
            overSlotKey: over?.slotKey,
          }
        : previous,
    );
  }

  /**
   * The write is decided from the event alone, never from `drag` state: a drop
   * that lands in the same frame as the last move would otherwise read a stale
   * hover target and plan the wrong day.
   */
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

    // The Later bay names no day of its own: hold the whole drop — the Area
    // move with it — until the calendar comes back with one.
    if (plan.needsDate) {
      setPendingLater({
        areaMove: plan.areaMove,
        at: items.find((item) => item.id === source.itemId)?.date,
        itemId: source.itemId,
        kind: source.kind,
      });
      return;
    }

    const date = plan.clears ? undefined : plan.date;

    if (source.kind === "task") {
      if (plan.reschedule) planTask(source.itemId, date);
      return;
    }

    planThread(source.itemId, {
      ...(plan.areaMove != null && { areaId: plan.areaMove }),
      ...(plan.reschedule && { followUp: date }),
    });
  }

  /** The one write the Later bay's calendar makes, then it forgets the drop. */
  function pickLaterDay(at: number) {
    if (pendingLater == null) return;
    const { areaMove, itemId, kind } = pendingLater;

    if (kind === "task") planTask(itemId, at);
    else {
      planThread(itemId, {
        ...(areaMove != null && { areaId: areaMove }),
        followUp: at,
      });
    }
    setPendingLater(null);
  }

  const laterItem =
    pendingLater && items.find((item) => item.id === pendingLater.itemId);
  // Resolved or completed elsewhere while the calendar was open: there is
  // nothing left to date, so the pending drop dissolves with it.
  useEffect(() => {
    if (pendingLater != null && laterItem == null) setPendingLater(null);
  }, [pendingLater, laterItem]);
  const laterHint =
    laterItem == null
      ? ""
      : pendingLater?.areaMove != null
        ? `${laterItem.title} → ${areaName(pendingLater.areaMove)}`
        : laterItem.title;

  const draggingItem = drag && items.find((item) => item.id === drag.itemId);
  const dropPlan = drag ? planDrop(drag, axis, areaName) : null;

  const chrome = { axis, density, drag, narrow, now, onOpen: openItem };

  return (
    <section aria-label="Plan" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "tabular-nums",
              tally.overdue > 0 && "font-medium text-condition-attention",
            )}
          >
            {tally.overdue} waiting
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{tally.today} today</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{tally.undated} undated</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{tally.inbox} in Inbox</span>
        </p>

        <div className="flex items-center gap-0.5 rounded-lg border border-border/70 p-0.5">
          {DENSITY_OPTIONS.map(({ icon: Icon, label, value }) => (
            <Button
              key={value}
              variant={density === value ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={density === value}
              aria-label={`${label} density`}
              title={`${label} density`}
              className="rounded-md"
              onClick={() => setDensity(value)}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
        </div>
      </header>

      <AreaFilterChips
        active={activeAreas}
        areas={areas}
        counts={areaCounts}
        onChange={setActiveAreas}
      />

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
              "Drag along the lane to pick an exact day, onto the ruler to reschedule in place, or into another Area lane to move the Thread. Press Enter to open it instead.",
          },
        }}
      >
        <div className="relative">
          {/* The native scrollbar would run the full width of the scroller —
              under the pinned lane headers and the two right-hand bays, which
              never move. It is hidden here and drawn by `PlanScrollbar` across the
              day region only. */}
          <div
            ref={setScrollNode}
            className="overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div style={{ minWidth: axis.minWidth }}>
              <AxisHeader
                areaCount={lanes.length}
                axis={axis}
                drag={drag}
                narrow={narrow}
                totals={totals}
              />

              {lanes.map((lane, index) => (
                <LaneRow
                  key={lane.id}
                  chrome={chrome}
                  lane={lane}
                  last={index === lanes.length - 1}
                />
              ))}

              <LaneRow chrome={chrome} lane={inbox} />
            </div>
          </div>

          {/* Edge fades: content slides *under* the pinned lane headers and
              the Later bay, so the seam reads as a fold, not as clipping. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-3 z-40 w-8 transition-opacity"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--surface-1) 0 35%, transparent 100%)",
              left: headerWidth,
              opacity: edges.start ? 1 : 0,
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-3 z-40 w-10 transition-opacity"
            style={{
              backgroundImage:
                "linear-gradient(to left, var(--surface-1) 0 35%, transparent 100%)",
              opacity: edges.end ? 1 : 0,
              right: pinnedRight,
            }}
          />

          <PlanScrollbar
            end={pinnedRight}
            metrics={metrics}
            node={scrollNode}
            start={headerWidth}
          />
        </div>

        {/* Undated work has no column on a calendar: it pools under the whole
            canvas instead, at full width and outside the day scroller. */}
        <NoDateBucket chrome={chrome} lanes={[...lanes, inbox]} />

        {tally.open === 0 && (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center font-heading text-sm font-semibold">
            Nothing to plan
          </p>
        )}

        <DragOverlay dropAnimation={null}>
          {draggingItem && drag && (
            <div
              style={{ width: bayWidth(density) }}
              className="cursor-grabbing"
            >
              <ChipSurface
                density={density}
                item={draggingItem}
                lifted
                now={now}
                slotKey={drag.slotKey}
              />
              {dropPlan && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex max-w-[15rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-2xs font-medium shadow-sm",
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

      <PlanLaterDialog
        // Remounts per drop, so the calendar always opens on the dropped
        // item's own month rather than the previous one's.
        key={pendingLater?.itemId}
        at={pendingLater?.at}
        hint={laterHint}
        now={now}
        open={pendingLater != null}
        onOpenChange={(open) => {
          if (!open) setPendingLater(null);
        }}
        onPick={pickLaterDay}
      />
    </section>
  );
}
