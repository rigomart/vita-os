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
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { Ban, CalendarPlus, CornerDownRight, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";

import type { ChipDragData, Density } from "./chip";
import type { DragState } from "./grid";
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
  HEADER_WIDTH,
  InboxGridRow,
  isValidTarget,
  NO_DATE_WIDTH,
} from "./grid";
import {
  BEYOND_KEY,
  beyondShortcuts,
  buildAreaRows,
  buildColumns,
  buildInboxCells,
  columnTotals,
  dayAt,
  INBOX_ROW_ID,
  landedLabel,
  NO_DATE_KEY,
  OVERDUE_KEY,
  quickDate,
  VISIBLE_DAYS,
} from "./model";
import { currentNotice, initialPlanState, planReducer } from "./plan-state";

/**
 * Plan — the **Day columns** variation.
 *
 * The time axis stops being fuzzy: Overdue, then Today, then each of the next
 * six days as its own column, then Beyond, then the pinned No date column. A
 * drop lands on the day you dropped on — the view never picks a date for you.
 *
 * Because the header carries the date, the chip does not: in a 112px column the
 * whole width is the title. Rows stay Areas, worst condition first, so dragging
 * sideways retargets the soft date and dragging up or down moves the Area.
 *
 * **Beyond** is the one column that is not a single day. Dropping there opens a
 * day picker anchored at the drop point — three one-tap Mondays and a calendar
 * floored at the end of the visible week — so the overflow still resolves to an
 * exact date rather than to "sometime later".
 */
export function DayColumnsPlan() {
  const now = NOW;
  const [state, dispatch] = useReducer(
    planReducer,
    undefined,
    initialPlanState,
  );
  const [density, setDensity] = useState<Density>("compact");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pending, setPending] = useState<PendingPick | null>(null);
  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );

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
    () => buildColumns(now, totals[OVERDUE_KEY] > 0),
    [now, totals],
  );

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) counts.set(row.area.id, row.openCount);
    return counts;
  }, [allRows]);

  const overdueCount = totals[OVERDUE_KEY] ?? 0;
  const todayCount = totals.d0 ?? 0;
  const undatedCount = totals[NO_DATE_KEY] ?? 0;
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
  }, [scrollNode, columns.length, rows.length, density]);

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
    setPending(null);
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

    // Beyond is the only column without a day of its own, so it asks for one
    // at the exact point the chip was released instead of guessing.
    if (column.drop === "pick") {
      const item = state.items.find((entry) => entry.id === active.itemId);
      const activator = event.activatorEvent as PointerEvent | null;
      setPending({
        itemId: active.itemId,
        rowId: over.rowId,
        title: item?.title ?? "",
        x: (activator?.clientX ?? window.innerWidth / 2) + event.delta.x,
        y: (activator?.clientY ?? window.innerHeight / 2) + event.delta.y,
      });
      return;
    }

    dispatch({
      date: column.drop === "clear" ? undefined : column.dropAt,
      itemId: active.itemId,
      reschedule: over.column !== active.column,
      toRowId: over.rowId,
      type: "drop",
    });
  }

  function resolvePending(date: number) {
    if (!pending) return;
    const item = state.items.find((entry) => entry.id === pending.itemId);
    dispatch({
      date,
      itemId: pending.itemId,
      reschedule: item?.date !== date,
      toRowId: pending.rowId,
      type: "drop",
    });
    setPending(null);
  }

  const draggingItem =
    drag && state.items.find((item) => item.id === drag.itemId);
  const dropCaption = describeDrop(drag, columns);
  const sourceColumn = drag
    ? (columns.find((entry) => entry.key === drag.column) ?? {
        key: drag.column,
        kind: "day" as const,
      })
    : undefined;

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
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDrag(null)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Drag sideways onto a day to set that exact date, or into another Area row to move the Thread. Press Enter to open it instead.",
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
                <div style={{ minWidth: gridMinWidth(columns, density) }}>
                  <ColumnHeaderRow
                    areaCount={rows.length}
                    columns={columns}
                    density={density}
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
          {draggingItem && drag && sourceColumn && (
            <div className="cursor-grabbing">
              <div className="w-[9.5rem]">
                <ChipSurface
                  column={sourceColumn}
                  density="compact"
                  item={draggingItem}
                  lifted
                  now={now}
                />
              </div>
              {dropCaption && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                    dropCaption.tone === "move" &&
                      "bg-foreground text-surface-1",
                    dropCaption.tone === "default" &&
                      "bg-surface-2 text-muted-foreground ring-1 ring-border",
                    dropCaption.tone === "pick" &&
                      "bg-surface-2 text-foreground ring-1 ring-border",
                    dropCaption.tone === "blocked" &&
                      "bg-surface-2 text-muted-foreground/70 ring-1 ring-border/60",
                  )}
                >
                  {dropCaption.tone === "blocked" ? (
                    <Ban className="size-2.5 shrink-0" />
                  ) : dropCaption.tone === "pick" ? (
                    <CalendarPlus className="size-2.5 shrink-0" />
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

      <BeyondPicker
        now={now}
        onCancel={() => setPending(null)}
        onPick={resolvePending}
        pending={pending}
      />

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

/* ----------------------------------------------------------------- beyond -- */

interface PendingPick {
  itemId: string;
  rowId: string;
  title: string;
  x: number;
  y: number;
}

/**
 * The Beyond drop resolver.
 *
 * A zero-size fixed trigger sits wherever the chip was released, so the picker
 * opens under the pointer rather than somewhere in the chrome. Three one-tap
 * Mondays cover almost every real answer; the calendar underneath is floored at
 * the end of the visible week, because anything inside it has its own column.
 */
function BeyondPicker({
  now,
  onCancel,
  onPick,
  pending,
}: {
  now: number;
  onCancel: () => void;
  onPick: (date: number) => void;
  pending: PendingPick | null;
}) {
  const shortcuts = useMemo(() => beyondShortcuts(now), [now]);
  const floor = useMemo(() => new Date(dayAt(VISIBLE_DAYS, now, 0)), [now]);

  return (
    <Popover
      open={pending != null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      {/* A zero-size trigger parked at the drop point: the popover has to open
          where the chip was let go, and Base UI positions against a trigger. */}
      <PopoverTrigger
        render={<button type="button" tabIndex={-1} aria-label="Pick a day" />}
        className="pointer-events-none fixed block size-0 overflow-hidden"
        style={{ left: pending?.x ?? 0, top: pending?.y ?? 0 }}
      />
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={10}
        className="w-auto gap-0 p-0"
      >
        <p className="max-w-[14rem] truncate px-3 pt-2.5 pb-2 text-[11px] text-muted-foreground">
          {pending?.title}
        </p>
        <div className="flex flex-col gap-px border-t border-border/60 p-1">
          {shortcuts.map((shortcut) => (
            <Button
              key={shortcut.at}
              variant="ghost"
              size="xs"
              className="justify-start tabular-nums"
              onClick={() => onPick(shortcut.at)}
            >
              {shortcut.label}
            </Button>
          ))}
        </div>
        <div className="border-t border-border/60">
          <Calendar
            mode="single"
            className="p-2 [--cell-size:--spacing(7)]"
            defaultMonth={new Date(shortcuts[0].at)}
            disabled={{ before: floor }}
            onSelect={(picked) => {
              if (!picked) return;
              const next = new Date(picked);
              next.setHours(9, 0, 0, 0);
              onPick(next.getTime());
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------------------------------------------- captions -- */

const noticeDot: Record<NoticeTone, string> = {
  default: "bg-brand-gold-strong",
  move: "bg-foreground",
  resolve: "bg-condition-healthy",
};

/** The caption pill riding under the drag ghost. */
function describeDrop(
  drag: DragState | null,
  columns: PlanColumn[],
): { text: string; tone: "blocked" | "default" | "move" | "pick" } | null {
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

  if (column.key === BEYOND_KEY) {
    const area = mockAreaById.get(drag.overRowId);
    return {
      text: movedArea ? `Move to ${area?.name} · pick a day` : "Pick a day",
      tone: movedArea ? "move" : "pick",
    };
  }

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
