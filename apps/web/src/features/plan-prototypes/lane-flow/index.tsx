import type { DragOverEvent, DragStartEvent } from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { Ban, CornerDownRight, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";

import type { SlotDropData } from "./axis";
import type { ChipDragData } from "./chip";
import type { Density, DragState, QuickTarget } from "./model";
import type { NoticeTone } from "./plan-state";

import { mockAreaById, mockAreas, NOW } from "../mock-data";
import { ThreadRailMock } from "../thread-rail-mock";
import { AxisHeader } from "./axis";
import { ChipSurface } from "./chip";
import { AreaFilterChips } from "./filters";
import { LaneRow } from "./lane";
import {
  bayWidth,
  buildAxis,
  buildLanes,
  HEADER_WIDTH,
  INBOX_LANE_ID,
  planDrop,
  quickDate,
} from "./model";
import { currentNotice, initialPlanState, planReducer } from "./plan-state";

/**
 * Plan — **Lane flow**.
 *
 * One shared, continuous day ruler across the top; every Area is a horizontal
 * band beneath it and every chip sits on its exact calendar day. The axis
 * *compresses*: days nothing is planned on shrink to a tick, so fourteen days
 * of real dates cost about as much width as six fuzzy horizon columns — and a
 * drop is always a specific date, never a bucket the app resolves for you.
 *
 * Dragging along a lane retargets the day. Dragging across lanes moves the
 * Thread's Area. Dragging up onto the ruler retargets the day without leaving
 * the lane. Opening a chip opens the app's Thread sidebar (mocked in
 * `../thread-rail-mock`), so Plan adds no second editor of its own.
 */
export function LaneFlowPlan() {
  const now = NOW;
  const [state, dispatch] = useReducer(
    planReducer,
    undefined,
    initialPlanState,
  );
  const [density, setDensity] = useState<Density>("compact");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );

  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ end: false, start: false });

  /**
   * Pointer-only, with a distance constraint. dnd-kit's KeyboardSensor claims
   * Enter/Space on every draggable, which would stop the keyboard from opening
   * the sidebar — the more valuable affordance here.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  /** Only what is on screen shapes the axis: hiding an Area collapses its days. */
  const visibleItems = useMemo(
    () =>
      state.items.filter(
        (item) =>
          item.kind === "task" ||
          activeAreas == null ||
          (item.areaId != null && activeAreas.has(item.areaId)),
      ),
    [state.items, activeAreas],
  );

  const axis = useMemo(
    () => buildAxis(visibleItems, now, density),
    [visibleItems, now, density],
  );

  const horizon = axis.days.length - 1;
  const { areaLanes, inbox } = useMemo(
    () => buildLanes(state.items, now, horizon),
    [state.items, now, horizon],
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

  const tally = useMemo(() => {
    const shown = [...lanes, inbox];
    const todayKey = axis.days[0]?.key;
    return {
      overdue: shown.reduce((sum, lane) => sum + lane.overdue.length, 0),
      today: shown.reduce(
        (sum, lane) => sum + (lane.byDay.get(todayKey ?? "")?.length ?? 0),
        0,
      ),
      undated: shown.reduce((sum, lane) => sum + lane.none.length, 0),
      open: lanes.reduce((sum, lane) => sum + lane.openCount, 0),
    };
  }, [lanes, inbox, axis.days]);

  const selected = state.items.find((item) => item.id === selectedId);
  const notice = currentNotice(state);

  /* ------------------------------------------- horizontal scroll edges -- */

  useEffect(() => {
    const node = scrollNode;
    if (!node) return;

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

  /* --------------------------------------------------------- keyboard -- */

  /**
   * Quick keys, deliberately unadvertised: they work for whoever finds them,
   * but the canvas does not spend a strip of chrome explaining itself.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
      ) {
        return;
      }

      if (event.key === "Escape") {
        setSelectedId(undefined);
        return;
      }
      if (!selectedId) return;

      const quick: Record<string, QuickTarget> = {
        e: "weekend",
        m: "tomorrow",
        t: "today",
        w: "next-week",
      };
      const key = event.key.toLowerCase();

      if (key in quick) {
        event.preventDefault();
        dispatch({
          date: quickDate(quick[key], now),
          itemId: selectedId,
          type: "set-date",
        });
        return;
      }
      if (key === "x") {
        event.preventDefault();
        dispatch({ date: undefined, itemId: selectedId, type: "set-date" });
        return;
      }
      if (key === "r") {
        event.preventDefault();
        dispatch({ itemId: selectedId, type: "resolve" });
        setSelectedId(undefined);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [now, selectedId]);

  /* ------------------------------------------------------------- drag -- */

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

  function handleDragEnd() {
    const snapshot = drag;
    setDrag(null);
    if (!snapshot) return;

    const plan = planDrop(snapshot, axis, areaName);
    if (!plan?.valid) return;

    dispatch({
      date: plan.clears ? undefined : plan.date,
      itemId: snapshot.itemId,
      reschedule: plan.reschedule,
      toAreaId: plan.areaMove,
      type: "drop",
    });
  }

  const draggingItem =
    drag && state.items.find((item) => item.id === drag.itemId);
  const dropPlan = drag ? planDrop(drag, axis, areaName) : null;

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 flex-col items-center justify-center rounded-lg bg-surface-3 text-brand-accent-foreground">
            <span className="text-[9px] leading-none font-medium tracking-wider uppercase opacity-70">
              {format(new Date(now), "MMM")}
            </span>
            <span className="mt-0.5 text-lg leading-none font-semibold tabular-nums">
              {format(new Date(now), "d")}
            </span>
          </span>
          <div>
            <h2 className="font-heading text-xl leading-tight font-semibold tracking-tight">
              Plan
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
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
          </div>
        </div>

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
        areas={mockAreas}
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
        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
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
                  />

                  {lanes.map((lane, index) => (
                    <LaneRow
                      key={lane.id}
                      chrome={{
                        axis,
                        density,
                        drag,
                        now,
                        onSelect: setSelectedId,
                        selectedId,
                      }}
                      lane={lane}
                      last={index === lanes.length - 1}
                    />
                  ))}

                  <LaneRow
                    chrome={{
                      axis,
                      density,
                      drag,
                      now,
                      onSelect: setSelectedId,
                      selectedId,
                    }}
                    lane={inbox}
                  />
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
                No open Threads
              </p>
            )}
          </div>

          {selected && (
            <ThreadRailMock
              areaById={mockAreaById}
              item={selected}
              now={now}
              onClose={() => setSelectedId(undefined)}
              onMoveArea={(itemId, toAreaId) =>
                dispatch({ itemId, toAreaId, type: "move-area" })
              }
              onResolve={(itemId) => {
                dispatch({ itemId, type: "resolve" });
                setSelectedId(undefined);
              }}
              onSetDate={(itemId, date) =>
                dispatch({ date, itemId, type: "set-date" })
              }
              onSetNextMove={(itemId, text) =>
                dispatch({ itemId, text, type: "set-next-move" })
              }
              onToggleNextMoveDone={(itemId) =>
                dispatch({ itemId, type: "complete-next-move" })
              }
            />
          )}
        </div>

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

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto flex max-w-[min(92vw,44rem)] items-center gap-2 rounded-full border border-border/70 bg-surface-2 py-1 pr-1 pl-3.5 text-xs shadow-lg ring-1 ring-foreground/5"
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                noticeDot[notice.tone],
              )}
            />
            <span className="max-w-[62%] shrink-0 truncate font-medium">
              {notice.message}
            </span>
            {notice.detail && (
              <span className="min-w-0 shrink truncate text-muted-foreground">
                {notice.detail}
              </span>
            )}
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0"
              onClick={() => dispatch({ type: "undo" })}
            >
              <Undo2 data-icon="inline-start" />
              Undo
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss"
              className="shrink-0 text-muted-foreground"
              onClick={() => dispatch({ type: "dismiss" })}
            >
              <X />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function areaName(laneId: string): string {
  return laneId === INBOX_LANE_ID
    ? "Inbox"
    : (mockAreaById.get(laneId)?.name ?? "another Area");
}

const noticeDot: Record<NoticeTone, string> = {
  default: "bg-brand-gold-strong",
  move: "bg-foreground",
  resolve: "bg-condition-healthy",
};
