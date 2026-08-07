// PROTOTYPE — throwaway. Copy of ../../plan/plan-canvas.tsx for Variant B: the
// tally row gains an "All areas steady." all-clear (the deleted area-health
// section's), and the lane/filter components come from this folder's copies.
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { Ban, CircleCheck, CornerDownRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import type { SlotDropData } from "@/features/dashboard/plan/plan-axis";
import type { ChipDragData } from "@/features/dashboard/plan/plan-chip";
import type {
  Density,
  DragState,
  PlanItem,
} from "@/features/dashboard/plan/plan-model";

import { AxisHeader } from "@/features/dashboard/plan/plan-axis";
import { ChipSurface } from "@/features/dashboard/plan/plan-chip";
import {
  bayWidth,
  buildAxis,
  buildLanes,
  buildPlanItems,
  HEADER_WIDTH,
  INBOX_LANE_ID,
  planDrop,
  slotTotals,
} from "@/features/dashboard/plan/plan-model";
import { usePlanActions } from "@/features/dashboard/plan/use-plan-actions";

import { AreaFilterChips } from "./plan-filters";
import { LaneRow } from "./plan-lane";

/**
 * Plan — the Area × day canvas.
 *
 * One shared, continuous day ruler across the top; every Area is a horizontal
 * band beneath it and every chip sits on its exact calendar day. The axis
 * *compresses*: days nothing is planned on shrink to a tick, so a fortnight of
 * real dates costs about as much width as a handful of fuzzy horizon columns —
 * and a drop is always a specific date, never a bucket the app resolves for you.
 *
 * Dragging along a lane retargets the day (a Thread's Follow-up, a Task's
 * When). Dragging across lanes moves the Thread's Area. Dragging up onto the
 * ruler retargets the day without leaving the lane. Every drop writes straight
 * through the app's own mutations, so it is logged and reversible by dragging
 * back — the canvas keeps no staged state of its own.
 *
 * Opening a chip opens the Thread rail in place via `?thread=<slug>`; Plan adds
 * no second editor.
 */
export function PlanCanvas({
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
  const { planTask, planThread } = usePlanActions();

  const [density, setDensity] = useState<Density>("compact");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );

  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ end: false, start: false });

  /**
   * Pointer-only, with a distance constraint. dnd-kit's KeyboardSensor claims
   * Enter/Space on every draggable, which would stop the keyboard from opening
   * the Thread rail — the more valuable affordance here.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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

  const axis = useMemo(
    () => buildAxis(visibleItems, now, density),
    [visibleItems, now, density],
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
      open:
        lanes.reduce((sum, lane) => sum + lane.openCount, 0) + inbox.openCount,
      overdue: totals.overdue,
      today: totals.byDay.get(axis.days[0]?.key ?? "") ?? 0,
      undated: totals.none,
    }),
    [lanes, inbox, totals, axis.days],
  );

  /**
   * The area-health section's all-clear, relocated: with the health cards gone,
   * the tally row is the one line that can say "nothing needs you".
   */
  const allSteady =
    areas.length > 0 && areas.every((area) => area.condition === "healthy");

  /* ------------------------------------------- horizontal scroll edges -- */

  useEffect(() => {
    const node = scrollNode;
    if (!node || typeof ResizeObserver === "undefined") return;

    const update = () => {
      // A detached or zero-width node measures as "nothing overflows"; ignore
      // it rather than flashing the fades off.
      if (node.clientWidth === 0) return;
      setEdges({
        end: node.scrollLeft + node.clientWidth < node.scrollWidth - 4,
        start: node.scrollLeft > 4,
      });
    };

    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [scrollNode, axis.minWidth, lanes.length]);

  /* ------------------------------------------------------------- open -- */

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

  const draggingItem = drag && items.find((item) => item.id === drag.itemId);
  const dropPlan = drag ? planDrop(drag, axis, areaName) : null;

  const chrome = { axis, density, drag, now, onOpen: openItem };

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {allSteady && (
            <>
              <span className="flex items-center gap-1 font-medium text-condition-healthy">
                <CircleCheck aria-hidden className="size-3" />
                All areas steady.
              </span>
              <span aria-hidden>·</span>
            </>
          )}
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
        </p>

        <div className="flex items-center gap-0.5 rounded-lg border border-border/70 p-0.5">
          {(["compact", "comfortable"] satisfies Density[]).map((value) => (
            <Button
              key={value}
              variant={density === value ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={density === value}
              className="rounded-md capitalize"
              onClick={() => setDensity(value)}
            >
              {value}
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
          <div
            ref={setScrollNode}
            className="overflow-x-auto pb-1 [scrollbar-width:thin]"
          >
            <div style={{ minWidth: axis.minWidth }}>
              <AxisHeader
                areaCount={lanes.length}
                axis={axis}
                drag={drag}
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
              the No-date bay, so the seam reads as a fold, not as clipping. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-40 w-8 transition-opacity"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--surface-1) 0 35%, transparent 100%)",
              left: HEADER_WIDTH,
              opacity: edges.start ? 1 : 0,
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-40 w-10 transition-opacity"
            style={{
              backgroundImage:
                "linear-gradient(to left, var(--surface-1) 0 35%, transparent 100%)",
              opacity: edges.end ? 1 : 0,
              right: bayWidth(density),
            }}
          />
        </div>

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
                density="compact"
                item={draggingItem}
                lifted
                now={now}
                slotKey={drag.slotKey}
              />
              {dropPlan && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex max-w-[15rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
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
