import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDndContext,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { Ban, CornerDownRight, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import type { ChipDragData, Density } from "./chip";
import type { CellDropData, DragState, Expansion, WeekDropData } from "./grid";
import type { ColumnKey, PlanColumn, QuickTarget } from "./model";
import type { NoticeTone } from "./plan-state";

import { mockAreaById, mockAreas, NOW } from "../mock-data";
import { ThreadRailMock } from "../thread-rail-mock";
import { ChipSurface } from "./chip";
import { AreaFilterChips } from "./filters";
import {
  AreaGridRow,
  ColumnHeaderRow,
  gridMinWidth,
  gridTemplate,
  HEADER_WIDTH,
  InboxGridRow,
  isValidTarget,
  NO_DATE_WIDTH,
} from "./grid";
import {
  buildAreaRows,
  buildColumns,
  buildInboxCells,
  columnTotals,
  dayDelta,
  expansionSlots,
  INBOX_ROW_ID,
  isSplittable,
  laterWeeks,
  quickDate,
} from "./model";
import { currentNotice, initialPlanState, planReducer } from "./plan-state";

/**
 * Plan — **Zoom horizons**.
 *
 * The board rests as fuzzy horizons, because that is what a week actually
 * feels like: Today, Tomorrow, This week, Next week, Later. Fuzzy columns are
 * the most glanceable thing you can put on a planning surface — and the worst
 * thing you can drop onto, because a fuzzy target has to invent a day for you.
 *
 * So the fuzziness is only a resting state. The instant a drag enters a
 * multi-day column it **zooms open in place** into its individual days, and
 * the drop lands on the exact one under the pointer. Leaving collapses it
 * back. The same zoom can be pinned by clicking a column header, for moving
 * chips between days without a long drag. `Later` runs forever, so its header
 * carries the week it is showing; sliding across those chips while dragging
 * walks the horizon out.
 *
 * Zooming never moves a lane vertically: the collapsed chip stack stays in the
 * flow as an invisible height ghost while the day slots lay over it, and the
 * grid template animates only sideways.
 */
export function ZoomHorizonsPlan() {
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

  /** Held open by a header click. Survives until re-click or Escape. */
  const [pinnedColumn, setPinnedColumn] = useState<ColumnKey | null>(null);
  /** Held open by the drag under way. Always wins over the pinned column. */
  const [hoverColumn, setHoverColumn] = useState<ColumnKey | null>(null);
  /** Which week of the endless `Later` horizon the zoom is showing. */
  const [laterWeek, setLaterWeek] = useState(0);

  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ end: false, start: false });

  /**
   * Pointer-only, with a distance constraint. dnd-kit's KeyboardSensor claims
   * Enter/Space on every draggable, which would stop the keyboard from opening
   * the sidebar — the more valuable affordance here. Keyboard *drag* is
   * therefore deliberately unsupported in this mockup; rescheduling from the
   * keyboard goes through the sidebar or the quick keys.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const allRows = useMemo(
    () => buildAreaRows(state.items, now),
    [state.items, now],
  );
  const rows = useMemo(
    () =>
      activeAreas == null
        ? allRows
        : allRows.filter((row) => activeAreas.has(row.area.id)),
    [allRows, activeAreas],
  );
  const inboxCells = useMemo(
    () => buildInboxCells(state.items, now),
    [state.items, now],
  );

  const totals = useMemo(
    () => columnTotals([...rows.map((row) => row.cells), inboxCells]),
    [rows, inboxCells],
  );
  const columns = useMemo(
    () => buildColumns(now, totals.overdue > 0),
    [now, totals.overdue],
  );
  const weeks = useMemo(() => laterWeeks(now), [now]);

  /* --------------------------------------------------------- zoom state -- */

  const expandedKey = hoverColumn ?? pinnedColumn;

  const expansion = useMemo<Expansion | null>(() => {
    if (expandedKey == null) return null;
    if (!columns.some((column) => column.key === expandedKey)) return null;

    const slots = expansionSlots(expandedKey, now, laterWeek);
    if (slots.length < 2) return null;

    return {
      key: expandedKey,
      pinned: hoverColumn == null,
      slots,
    };
  }, [columns, expandedKey, hoverColumn, laterWeek, now]);

  const toggleColumn = useCallback((key: ColumnKey) => {
    if (!isSplittable(key)) return;
    setPinnedColumn((previous) => (previous === key ? null : key));
  }, []);

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) counts.set(row.area.id, row.openCount);
    return counts;
  }, [allRows]);

  const overdueCount = totals.overdue;
  const todayCount = totals.today;
  const undatedCount = totals.none;
  const threadCount = rows.reduce((sum, row) => sum + row.openCount, 0);
  const taskCount = state.items.filter((item) => item.kind === "task").length;

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
  }, [scrollNode, columns.length, rows.length]);

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
        // Escape closes the zoom first — it is the more recent, more modal
        // thing on screen — and only then lets go of the selection.
        setPinnedColumn((previous) => {
          if (previous != null) return null;
          setSelectedId(undefined);
          return previous;
        });
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
      column: data.column,
      itemId: data.itemId,
      kind: data.kind,
      rowId: data.rowId,
    });
  }

  /**
   * The zoom mechanic, in one handler.
   *
   * Whatever the pointer is over decides which column is open. A `null` `over`
   * (the pointer between two droppables, or over the header chrome) is treated
   * as "no news" and holds the current zoom, otherwise the column would
   * flicker shut every time the pointer crossed a border.
   */
  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.data.current as
      | (CellDropData & Partial<WeekDropData>)
      | undefined;

    if (over?.laterWeek != null) {
      setLaterWeek(over.laterWeek);
      setHoverColumn("later");
      setDrag((previous) =>
        previous
          ? { ...previous, overAt: undefined, overColumn: "later" }
          : previous,
      );
      return;
    }

    if (over?.column != null) {
      setHoverColumn(isSplittable(over.column) ? over.column : null);
    }

    setDrag((previous) =>
      previous
        ? {
            ...previous,
            overAt: over?.dropAt,
            overColumn: over?.column,
            overRowId: over?.rowId,
          }
        : previous,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as ChipDragData | undefined;
    const over = event.over?.data.current as
      | (CellDropData & Partial<WeekDropData>)
      | undefined;
    const snapshot = drag;
    setDrag(null);
    setHoverColumn(null);
    if (!active || !over || !snapshot) return;
    // Week chips steer the zoom; they are not a place to put a Thread.
    if (over.laterWeek != null || over.column == null) return;

    const column = columns.find((entry) => entry.key === over.column);
    if (!column || column.drop === null) return;
    if (!isValidTarget(snapshot, over.rowId, column)) return;

    const item = state.items.find((entry) => entry.id === active.itemId);
    const date = column.drop === "clear" ? undefined : over.dropAt;

    dispatch({
      columnDrop: column.drop,
      date,
      itemId: active.itemId,
      reschedule: item == null || !sameDay(item.date, date, now),
      toRowId: over.rowId,
      type: "drop",
    });
  }

  const draggingItem =
    drag && state.items.find((item) => item.id === drag.itemId);
  const dropCaption = describeDrop(drag, columns, draggingItem?.date, now);

  const chrome = {
    columns,
    density,
    dispatch,
    drag,
    expansion,
    now,
    onSelect: setSelectedId,
    selectedId,
  };

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
                  overdueCount > 0 && "font-medium text-condition-attention",
                )}
              >
                {overdueCount} overdue
              </span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{todayCount} today</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{undatedCount} undated</span>
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
        // The board relayouts under the pointer while a column zooms open, so
        // droppable rects have to be re-read continuously, not cached on lift.
        // dnd-kit measures during render — i.e. against the layout the zoom is
        // about to replace — so a plain `Always` strategy is not enough; the
        // polling frequency (and `ZoomMeasurer` below) is what keeps the day
        // slots honest about where they actually are.
        measuring={{
          droppable: { frequency: 40, strategy: MeasuringStrategy.Always },
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDrag(null);
          setHoverColumn(null);
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Drag sideways to retarget the date; multi-day columns open into their days as you enter them. Drag into another Area row to move the Thread. Press Enter to open it instead.",
          },
        }}
      >
        <ZoomMeasurer
          signature={`${expansion?.key ?? "none"}:${expansion?.slots.length ?? 0}:${laterWeek}`}
        />

        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="relative">
              <div
                ref={setScrollNode}
                className="overflow-x-auto pb-1 [scrollbar-width:thin]"
              >
                <div
                  className="relative"
                  style={{ minWidth: gridMinWidth(columns.length) }}
                >
                  <ColumnHeaderRow
                    areaCount={rows.length}
                    columns={columns}
                    expansion={expansion}
                    laterWeek={laterWeek}
                    onFocusWeek={setLaterWeek}
                    onToggleColumn={toggleColumn}
                    totals={totals}
                    weeks={weeks}
                  />

                  {rows.map((row) => (
                    <AreaGridRow key={row.area.id} chrome={chrome} row={row} />
                  ))}

                  <InboxGridRow
                    cells={inboxCells}
                    chrome={chrome}
                    taskCount={taskCount}
                  />

                  {/* The zoomed column's footprint, drawn across the whole
                      board so the split reads as one continuous cut rather
                      than a stack of independently open cells. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-40 grid transition-[grid-template-columns] duration-150 ease-out"
                    style={{
                      gridTemplateColumns: gridTemplate(columns, expansion),
                    }}
                  >
                    {columns.map((column, index) => (
                      <span
                        key={column.key}
                        style={{ gridColumn: index + 2, gridRow: 1 }}
                        className={cn(
                          "transition-opacity duration-150",
                          expansion?.key === column.key
                            ? "opacity-100 ring-1 ring-foreground/15 ring-inset"
                            : "opacity-0",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Edge fades: content slides *under* the pinned columns, so the
                  seam has to read as a fold, not as clipped text. */}
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
                  right: NO_DATE_WIDTH,
                }}
              />
            </div>

            {threadCount === 0 && (
              <p className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center font-heading text-sm font-semibold">
                {taskCount === 0 ? "Nothing left waiting" : "No open Threads"}
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
            <div className="w-[9.5rem] cursor-grabbing">
              <ChipSurface
                column={drag.column}
                density="compact"
                item={draggingItem}
                lifted
                now={now}
              />
              {dropCaption && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex max-w-[15rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                    dropCaption.tone === "move" &&
                      "bg-foreground text-surface-1",
                    dropCaption.tone === "default" &&
                      "bg-surface-2 text-muted-foreground ring-1 ring-border",
                    dropCaption.tone === "blocked" &&
                      "bg-surface-2 text-muted-foreground/70 ring-1 ring-border/60",
                  )}
                >
                  {dropCaption.tone === "blocked" ? (
                    <Ban className="size-2.5 shrink-0" />
                  ) : (
                    <CornerDownRight className="size-2.5 shrink-0" />
                  )}
                  {dropCaption.text}
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
            {/* The action keeps its words; the context gives them up first. */}
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

/** How long the grid template takes to settle, plus a frame of slack. */
const ZOOM_SETTLE_MS = 200;

/**
 * Re-measures every drop target for as long as a zoom is animating.
 *
 * Without this, the day slots are hit-tested against the column widths they
 * had *before* the zoom, and the drop lands days away from the pointer.
 */
function ZoomMeasurer({ signature }: { signature: string }) {
  const { droppableContainers, measureDroppableContainers } = useDndContext();

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();

    const tick = () => {
      measureDroppableContainers(
        droppableContainers.toArray().map((container) => container.id),
      );
      if (performance.now() - startedAt < ZOOM_SETTLE_MS) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Only the zoom changing restarts the loop; the context values it reads
    // are stable for the lifetime of the drag.
  }, [droppableContainers, measureDroppableContainers, signature]);

  return null;
}

const noticeDot: Record<NoticeTone, string> = {
  default: "bg-brand-gold-strong",
  move: "bg-foreground",
  resolve: "bg-condition-healthy",
};

function sameDay(
  left: number | undefined,
  right: number | undefined,
  now: number,
): boolean {
  if (left == null || right == null) return left == null && right == null;
  return dayDelta(left, now) === dayDelta(right, now);
}

/** The caption pill riding under the drag ghost. */
function describeDrop(
  drag: DragState | null,
  columns: PlanColumn[],
  currentDate: number | undefined,
  now: number,
): { text: string; tone: "blocked" | "default" | "move" } | null {
  if (!drag?.overColumn || !drag.overRowId) return null;

  const column = columns.find((entry) => entry.key === drag.overColumn);
  if (!column) return null;

  if (column.drop === null) {
    return { text: "Can't plan into the past", tone: "blocked" };
  }
  // Riding the `Later` week picker: the horizon moved, no day chosen yet.
  if (column.span > 1 && drag.overAt == null) {
    return { text: `${column.label} — pick a day`, tone: "blocked" };
  }
  if (!isValidTarget(drag, drag.overRowId, column)) {
    return {
      text:
        drag.kind === "task"
          ? "Tasks stay in the Inbox"
          : "Threads live in an Area",
      tone: "blocked",
    };
  }

  const movedArea =
    drag.kind === "thread" &&
    drag.overRowId !== drag.rowId &&
    drag.overRowId !== INBOX_ROW_ID;
  const landsAt = column.drop === "clear" ? undefined : drag.overAt;
  const rescheduled = !sameDay(currentDate, landsAt, now);
  const when =
    landsAt == null ? "no date" : format(new Date(landsAt), "EEE d MMM");

  if (movedArea) {
    const area = mockAreaById.get(drag.overRowId);
    return {
      text: rescheduled
        ? `Move to ${area?.name} · ${when}`
        : `Move to ${area?.name}`,
      tone: "move",
    };
  }
  if (!rescheduled) return null;

  return {
    text: landsAt == null ? "Clear the date" : `Lands ${when}`,
    tone: "default",
  };
}
