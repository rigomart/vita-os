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
import { Button } from "@vita-os/ui/components/button";
import { Kbd } from "@vita-os/ui/components/kbd";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { Ban, CornerDownRight, Sparkles, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";

import type { ChipDragData, Density } from "./chip";
import type { DragState } from "./grid";
import type { ColumnKey, PlanColumn, QuickTarget } from "./model";
import type { NoticeTone } from "./plan-state";
import type { ReviewEntry } from "./review";

import { mockAreaById, mockAreas, NOW } from "../mock-data";
import { ChipSurface } from "./chip";
import { AreaFilterChips } from "./filters";
import {
  AreaGridRow,
  ColumnHeaderRow,
  gridMinWidth,
  HEADER_WIDTH,
  InboxGridRow,
  isValidTarget,
  NO_DATE_WIDTH,
} from "./grid";
import {
  buildAreaRows,
  buildColumns,
  buildInboxCells,
  buildQueue,
  columnTotals,
  INBOX_ROW_ID,
  landedLabel,
  quickDate,
} from "./model";
import { currentNotice, initialPlanState, planReducer } from "./plan-state";
import { PlanRail } from "./rail";
import { ReviewMode } from "./review";

/**
 * Plan — the converged design.
 *
 * Three surfaces over one local state:
 *
 * - **The grid** is an Area × time canvas. Rows are Life Areas worst condition
 *   first plus a pinned Inbox row for Tasks; columns are fuzzy horizons that
 *   publish the exact date a drop will assign. Dragging sideways retargets the
 *   soft date, dragging into another row moves the Thread's Area.
 * - **The rail** is a persistent editor. Selecting a chip opens it and it stays
 *   open across every edit, so a planning pass is one continuous motion.
 * - **Review** turns the same state into a guided, card-at-a-time pass over
 *   everything still waiting on a decision.
 *
 * Every mutation pushes an undo snapshot. The confirmation strip never expires.
 */
export function FinalPlan() {
  const now = NOW;
  const [state, dispatch] = useReducer(
    planReducer,
    undefined,
    initialPlanState,
  );
  const [density, setDensity] = useState<Density>("compact");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [focusSignal, setFocusSignal] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );
  const [review, setReview] = useState<ReviewEntry[] | undefined>(undefined);

  // A callback ref, not a plain one: Review mode unmounts the grid, and the
  // effect below has to re-attach to the *new* scrollport when it comes back.
  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ end: false, start: false });

  /**
   * Pointer-only, with a distance constraint. dnd-kit's KeyboardSensor claims
   * Enter/Space on every draggable, which would stop the keyboard from opening
   * the rail — the more valuable affordance here. Keyboard *drag* is therefore
   * deliberately unsupported in this mockup; rescheduling from the keyboard
   * goes through the rail's presets (T / M / E / W) instead.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) counts.set(row.area.id, row.openCount);
    return counts;
  }, [allRows]);

  const queueGroups = useMemo(
    () => buildQueue(visibleItems, now),
    [visibleItems, now],
  );
  const queue = useMemo<ReviewEntry[]>(
    () =>
      queueGroups.flatMap((group) =>
        group.items.map((item) => ({
          groupHint: group.hint,
          groupKey: group.key,
          groupLabel: group.label,
          id: item.id,
        })),
      ),
    [queueGroups],
  );

  const overdueCount = totals.overdue;
  const todayCount = totals.today;
  const undatedCount = totals.none;
  const threadCount = rows.reduce((sum, row) => sum + row.openCount, 0);
  const taskCount = state.items.filter((item) => item.kind === "task").length;

  const selected = state.items.find((item) => item.id === selectedId);
  const notice = currentNotice(state);

  /** Reading order across the grid: rows top to bottom, columns left to right. */
  const flatOrder = useMemo(() => {
    const keys = columns.map((column) => column.key);
    const ids: string[] = [];
    for (const row of rows) {
      for (const key of keys) {
        for (const item of row.cells[key]) ids.push(item.id);
      }
    }
    for (const key of keys) {
      for (const item of inboxCells[key]) ids.push(item.id);
    }
    return ids;
  }, [rows, inboxCells, columns]);

  function resolveItem(id: string) {
    // Selection advances to the next thing needing attention; it never chases
    // an item that merely moved.
    const index = flatOrder.indexOf(id);
    const next = flatOrder[index + 1] ?? flatOrder[index - 1];
    dispatch({ itemId: id, type: "resolve" });
    setSelectedId(next);
  }

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

  useEffect(() => {
    if (review) return;

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

      // Enter on a focused chip is the browser's click — let it through.
      if (event.key === "Enter") {
        if (target?.tagName === "BUTTON") return;
        event.preventDefault();
        setFocusSignal((value) => value + 1);
        return;
      }

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
        resolveItem(selectedId);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

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

  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.data.current as
      | { column: ColumnKey; rowId: string }
      | undefined;
    setDrag((previous) =>
      previous
        ? { ...previous, overColumn: over?.column, overRowId: over?.rowId }
        : previous,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as ChipDragData | undefined;
    const over = event.over?.data.current as
      | { column: ColumnKey; rowId: string }
      | undefined;
    const snapshot = drag;
    setDrag(null);
    if (!active || !over || !snapshot) return;

    const column = columns.find((entry) => entry.key === over.column);
    if (!column || column.drop === null) return;
    if (!isValidTarget(snapshot, over.rowId, column)) return;

    dispatch({
      columnDrop: column.drop,
      date: column.drop === "clear" ? undefined : column.dropAt,
      itemId: active.itemId,
      reschedule: over.column !== active.column,
      toRowId: over.rowId,
      type: "drop",
    });
    setSelectedId(active.itemId);
  }

  const draggingItem =
    drag && state.items.find((item) => item.id === drag.itemId);
  const dropCaption = describeDrop(drag, columns);

  /* ------------------------------------------------------------ render -- */

  if (review) {
    return (
      <ReviewMode
        areaById={mockAreaById}
        dispatch={dispatch}
        items={state.items}
        now={now}
        onExit={() => setReview(undefined)}
        queue={review}
      />
    );
  }

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
              Where your attention is going
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

        <div className="flex flex-wrap items-center gap-2">
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

          <Button
            disabled={queue.length === 0}
            onClick={() => setReview(queue)}
          >
            <Sparkles data-icon="inline-start" />
            Start review
            <span className="ml-0.5 tabular-nums opacity-70">
              {queue.length}
            </span>
          </Button>
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
              "Drag this chip sideways to retarget its date, or into another Area row to move the Thread. To use the keyboard instead, press Enter to open the editor.",
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
                <div style={{ minWidth: gridMinWidth(columns.length) }}>
                  <ColumnHeaderRow
                    areaCount={rows.length}
                    columns={columns}
                    totals={totals}
                  />

                  {rows.map((row) => (
                    <AreaGridRow
                      key={row.area.id}
                      chrome={{
                        columns,
                        density,
                        dispatch,
                        drag,
                        now,
                        onSelect: setSelectedId,
                        selectedId,
                      }}
                      row={row}
                    />
                  ))}

                  <InboxGridRow
                    cells={inboxCells}
                    chrome={{
                      columns,
                      density,
                      dispatch,
                      drag,
                      now,
                      onSelect: setSelectedId,
                      selectedId,
                    }}
                    taskCount={taskCount}
                  />
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
              <EmptyPlan
                title={
                  taskCount === 0 ? "Nothing left waiting" : "No open Threads"
                }
                body={
                  taskCount === 0
                    ? "Every Thread is resolved and the Inbox is clear. Undo below if that was one step too far."
                    : activeAreas == null
                      ? "Every Thread is resolved. The Inbox row still holds your loose Tasks."
                      : "Nothing open in the Areas you're looking at. The Inbox row still holds your loose Tasks."
                }
              />
            )}

            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Drag sideways to retarget a date · into another row to move the
              Area · the Area and No date columns stay pinned
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/60">
              <Hint keys={["↵"]} label="edit Next Move" />
              <Hint keys={["T"]} label="today" />
              <Hint keys={["M"]} label="tomorrow" />
              <Hint keys={["E"]} label="weekend" />
              <Hint keys={["W"]} label="next week" />
              <Hint keys={["X"]} label="clear date" />
              <Hint keys={["R"]} label="resolve" />
              <Hint keys={["Esc"]} label="close editor" />
            </p>
          </div>

          <PlanRail
            areaById={mockAreaById}
            areas={mockAreas}
            dispatch={dispatch}
            focusSignal={focusSignal}
            item={selected}
            now={now}
            onClose={() => setSelectedId(undefined)}
            className={cn(
              // Below xl the rail floats over the grid, pinned to the viewport
              // so nothing in it can fall below the fold; at xl it takes its
              // own column and sticks alongside the grid.
              "fixed inset-y-4 right-4 z-50 shadow-xl xl:sticky xl:inset-auto xl:top-4 xl:z-auto xl:max-h-[calc(100svh-4rem)] xl:self-start xl:shadow-none",
              !selected && "hidden xl:flex",
            )}
          />
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
                    "mt-1.5 inline-flex max-w-[13rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
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

const noticeDot: Record<NoticeTone, string> = {
  default: "bg-brand-gold-strong",
  move: "bg-foreground",
  resolve: "bg-condition-healthy",
};

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key} className="h-4.5 min-w-4.5 text-[10px]">
          {key}
        </Kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}

function EmptyPlan({ body, title }: { body: string; title: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="font-heading text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

/** The caption pill riding under the drag ghost. */
function describeDrop(
  drag: DragState | null,
  columns: PlanColumn[],
): { text: string; tone: "blocked" | "default" | "move" } | null {
  if (!drag?.overRowId || !drag.overColumn) return null;

  const column = columns.find((entry) => entry.key === drag.overColumn);
  if (!column) return null;

  if (column.drop === null) {
    return { text: "Can't plan into the past", tone: "blocked" };
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
  const rescheduled = drag.overColumn !== drag.column;
  const when =
    column.drop === "clear"
      ? "no date"
      : landedLabel(column.dropAt, drag.kind).replace(
          /^(resurfaces|set for) /,
          "",
        );

  if (movedArea) {
    const area = mockAreaById.get(drag.overRowId);
    return {
      text: rescheduled
        ? `Move to ${area?.name} · ${when}`
        : `Move to ${area?.name}`,
      tone: "move",
    };
  }
  if (rescheduled) {
    return {
      text: column.drop === "clear" ? "Clear the date" : `Lands ${when}`,
      tone: "default",
    };
  }
  return null;
}
