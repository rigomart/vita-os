import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import { TooltipProvider } from "@vita-os/ui/components/tooltip";
import { cn } from "@vita-os/ui/lib/utils";
import { CornerDownRight, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";

import type { CellDropData, DragState } from "./grid";
import type { NoticeTone } from "./plan-state";
import type { ChipDragData, Density } from "./thread-chip";

import { NOW } from "../mock-data";
import {
  AreaGridRow,
  ColumnHeaderRow,
  gridMinWidth,
  gridTemplate,
} from "./grid";
import { buildColumns, buildRows, columnTotals } from "./model";
import { initialPlanState, planReducer } from "./plan-state";
import { ChipSurface } from "./thread-chip";

const NOTICE_MS = 5000;

/**
 * Area × time grid.
 *
 * Rows are Life Areas ordered by Condition, columns are fuzzy time horizons.
 * The value is balance: one glance shows where attention is going and which
 * parts of life have nothing on the near horizon. Dragging a chip sideways
 * retargets its Follow-up; dragging it into another row moves the Thread to
 * that Area (a bigger, logged action, so it is signposted harder).
 */
export function AreaGridPlan() {
  const now = NOW;
  const [state, dispatch] = useReducer(
    planReducer,
    undefined,
    initialPlanState,
  );
  const [density, setDensity] = useState<Density>("comfortable");
  const [focusMode, setFocusMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const rows = useMemo(
    () => buildRows(state.threads, now),
    [state.threads, now],
  );
  const visibleRows = useMemo(
    () =>
      focusMode ? rows.filter((row) => row.area.condition !== "healthy") : rows,
    [rows, focusMode],
  );
  const hiddenCount = rows.length - visibleRows.length;

  // Totals describe what is on screen, so the load bars never overstate a
  // column the reader cannot see.
  const totals = useMemo(() => columnTotals(visibleRows), [visibleRows]);
  const columns = useMemo(
    () => buildColumns(now, totals.overdue > 0),
    [now, totals.overdue],
  );

  const activeThread =
    drag && state.threads.find((thread) => thread.id === drag.threadId);
  const overColumn = columns.find((column) => column.key === drag?.overColumn);
  const dropCaption = describeDrop(drag, overColumn?.label, overColumn?.drop);

  const noticeId = state.notice?.id;
  useEffect(() => {
    if (noticeId == null) return;
    const timer = setTimeout(() => dispatch({ type: "dismiss" }), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [noticeId]);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ChipDragData | undefined;
    if (!data) return;
    setDrag({
      areaId: data.areaId,
      column: data.column,
      threadId: data.threadId,
    });
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.data.current as CellDropData | undefined;
    setDrag((previous) =>
      previous
        ? { ...previous, overAreaId: over?.areaId, overColumn: over?.column }
        : previous,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as ChipDragData | undefined;
    const over = event.over?.data.current as CellDropData | undefined;
    setDrag(null);
    if (!active || !over) return;

    const column = columns.find((entry) => entry.key === over.column);
    if (!column || column.drop === null) return;

    const reschedule = over.column !== active.column;
    dispatch({
      columnLabel: column.drop === "clear" ? "cleared" : column.label,
      followUp: column.drop === "clear" ? undefined : column.dropAt,
      reschedule,
      threadId: active.threadId,
      toAreaId: over.areaId,
      type: "drop",
    });
  }

  const undated = state.threads.filter((thread) => thread.followUp == null);

  return (
    <TooltipProvider delay={350}>
      <section className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Where your attention is going
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="tabular-nums">{state.threads.length}</span>{" "}
              Threads across <span className="tabular-nums">{rows.length}</span>{" "}
              Areas · <span className="tabular-nums">{undated.length}</span>{" "}
              with no Follow-up
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-border/70 p-0.5">
              {(["comfortable", "compact"] satisfies Density[]).map((value) => (
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
              variant={focusMode ? "secondary" : "outline"}
              size="sm"
              aria-pressed={focusMode}
              className="rounded-lg"
              onClick={() => setFocusMode((value) => !value)}
            >
              Only Areas needing me
              {focusMode && hiddenCount > 0 && (
                <span className="tabular-nums text-muted-foreground">
                  · {hiddenCount} hidden
                </span>
              )}
            </Button>
          </div>
        </header>

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
                "Press space to pick up this Thread. Use the arrow keys to move it across time columns to change its Follow-up, or into another Area row to move the Thread. Press space to drop, escape to cancel.",
            },
          }}
        >
          {/* No horizontal padding: the sticky Area column pins to `left-0` of
              this scrollport, and padding would let chips bleed past it. */}
          <div className="overflow-x-auto pb-1">
            <div style={{ minWidth: gridMinWidth(columns.length) }}>
              <ColumnHeaderRow
                areaCount={visibleRows.length}
                columns={columns}
                totals={totals}
              />

              {visibleRows.map((row) => (
                <AreaGridRow
                  key={row.area.id}
                  columns={columns}
                  density={density}
                  dispatch={dispatch}
                  drag={drag}
                  now={now}
                  row={row}
                />
              ))}

              {visibleRows.length === 0 && (
                <EmptyGrid columnCount={columns.length} />
              )}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeThread && (
              <div className="w-[9.5rem] cursor-grabbing">
                <ChipSurface
                  column={drag?.column ?? "none"}
                  density={density}
                  lifted
                  now={now}
                  thread={activeThread}
                />
                {dropCaption && (
                  <span
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                      dropCaption.tone === "move"
                        ? "bg-foreground text-surface-1"
                        : "bg-surface-2 text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    <CornerDownRight className="size-2.5" />
                    {dropCaption.text}
                  </span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          {state.notice && (
            <div
              key={state.notice.id}
              role="status"
              className="pointer-events-auto flex max-w-full animate-in items-center gap-2 rounded-full border border-border/70 bg-surface-2 py-1 pr-1 pl-3.5 text-xs shadow-lg ring-1 ring-foreground/5 fade-in slide-in-from-bottom-2"
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  noticeDot[state.notice.tone],
                )}
              />
              <span className="shrink-0 font-medium">
                {state.notice.message}
              </span>
              {state.notice.detail && (
                <span className="min-w-0 truncate text-muted-foreground">
                  {state.notice.detail}
                </span>
              )}
              {state.notice.undoable && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0"
                  onClick={() => dispatch({ type: "undo" })}
                >
                  <Undo2 />
                  Undo
                </Button>
              )}
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
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          Drag a chip sideways to retarget its Follow-up · drag it into another
          row to move the Thread to that Area · click a chip to edit it in
          place.
        </p>
      </section>
    </TooltipProvider>
  );
}

const noticeDot: Record<NoticeTone, string> = {
  default: "bg-condition-healthy",
  move: "bg-foreground",
  resolve: "bg-condition-healthy",
};

function describeDrop(
  drag: DragState | null,
  columnLabel: string | undefined,
  drop: "schedule" | "clear" | null | undefined,
): { text: string; tone: "default" | "move" } | null {
  if (!drag?.overAreaId || drop == null) return null;

  const movedArea = drag.overAreaId !== drag.areaId;
  const rescheduled = drag.overColumn !== drag.column;
  const when =
    drop === "clear" ? "no Follow-up" : (columnLabel ?? "").toLowerCase();

  if (movedArea && rescheduled) {
    return { text: `Move Area · ${when}`, tone: "move" };
  }
  if (movedArea) return { text: "Move to this Area", tone: "move" };
  if (rescheduled) return { text: `Follow-up ${when}`, tone: "default" };
  return null;
}

function EmptyGrid({ columnCount }: { columnCount: number }) {
  return (
    <div
      className="grid w-full"
      style={{ gridTemplateColumns: gridTemplate(columnCount) }}
    >
      <div className="col-span-full px-4 py-10 text-center">
        <p className="font-heading text-sm font-semibold">Everything is calm</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No Area is critical or needs attention right now.
        </p>
      </div>
    </div>
  );
}
