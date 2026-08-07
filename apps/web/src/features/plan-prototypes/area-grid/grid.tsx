import { conditionLabels } from "@convex/lib/condition";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { addDays, startOfDay } from "date-fns";
import { CircleDashed, CornerDownRight, Sparkles } from "lucide-react";
import { useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockThread } from "../mock-data";
import type { AreaRow, ColumnKey, PlanColumn } from "./model";
import type { PlanAction } from "./plan-state";
import type { Density } from "./thread-chip";

import { mockAreaById } from "../mock-data";
import {
  columnBarTone,
  columnLabelTone,
  conditionIconTone,
  conditionRailTone,
  conditionRowTint,
  followUpLabel,
} from "./model";
import { ThreadChip } from "./thread-chip";

const HEADER_WIDTH = 212;
const MIN_COLUMN_WIDTH = 154;

export interface DragState {
  /** Area the chip started in. */
  areaId: string;
  /** Column the chip started in. */
  column: ColumnKey;
  overAreaId?: string;
  overColumn?: ColumnKey;
  threadId: string;
}

export interface CellDropData {
  areaId: string;
  column: ColumnKey;
}

export function gridTemplate(columnCount: number): string {
  return `${HEADER_WIDTH}px repeat(${columnCount}, minmax(${MIN_COLUMN_WIDTH}px, 1fr))`;
}

export function gridMinWidth(columnCount: number): number {
  return HEADER_WIDTH + columnCount * MIN_COLUMN_WIDTH;
}

/* ------------------------------------------------------------- header row -- */

export function ColumnHeaderRow({
  areaCount,
  columns,
  totals,
}: {
  areaCount: number;
  columns: PlanColumn[];
  totals: Record<ColumnKey, number>;
}) {
  const peak = Math.max(1, ...columns.map((column) => totals[column.key]));

  return (
    <div
      className="grid w-full border-b border-border"
      style={{ gridTemplateColumns: gridTemplate(columns.length) }}
    >
      <div className="sticky left-0 z-20 flex flex-col justify-end gap-1.5 bg-surface-1 px-3.5 pt-1 pb-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {areaCount} Areas
        </span>
        <span className="h-[3px]" />
        <span className="truncate text-[10px] text-muted-foreground/60">
          worst condition first
        </span>
      </div>

      {columns.map((column, index) => (
        <div
          key={column.key}
          className={cn(
            "flex flex-col gap-1.5 px-2.5 pt-1 pb-2",
            index === 0
              ? "border-l border-border"
              : "border-l border-border/35",
            column.key === "today" && "bg-surface-3/45",
          )}
        >
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-[11px] font-semibold tracking-[0.06em] uppercase",
                columnLabelTone[column.tone],
              )}
            >
              {column.label}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {totals[column.key]}
            </span>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
            <div
              className={cn("h-full rounded-full", columnBarTone[column.tone])}
              style={{ width: `${(totals[column.key] / peak) * 100}%` }}
            />
          </div>
          <span className="truncate text-[10px] text-muted-foreground/60">
            {column.caption}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- area row -- */

export function AreaGridRow({
  columns,
  density,
  dispatch,
  drag,
  now,
  row,
}: {
  columns: PlanColumn[];
  density: Density;
  dispatch: (action: PlanAction) => void;
  drag: DragState | null;
  now: number;
  row: AreaRow;
}) {
  const incoming =
    drag != null &&
    drag.overAreaId === row.area.id &&
    drag.areaId !== row.area.id;

  return (
    <div
      className={cn(
        "group/row relative grid w-full border-b border-border/50 transition-colors last:border-b-0",
        conditionRowTint[row.area.condition],
        incoming && "bg-surface-3/70 ring-1 ring-foreground/15 ring-inset",
      )}
      style={{ gridTemplateColumns: gridTemplate(columns.length) }}
    >
      {/* Hollow row: a dashed rule laid across the dated columns only, so it
          never runs behind the chips parked in "No date". */}
      {row.hollow && !drag && (
        <span
          aria-hidden
          className="pointer-events-none flex items-center gap-3 px-4"
          style={{ gridColumn: "2 / -2", gridRow: 1 }}
        >
          <span className="h-px flex-1 border-t border-dashed border-border/70" />
          <span className="text-[11px] text-muted-foreground/50">
            Nothing planned
          </span>
          <span className="h-px flex-1 border-t border-dashed border-border/70" />
        </span>
      )}

      <RowHeader incoming={incoming} row={row} />

      {columns.map((column, index) => (
        <GridCell
          key={column.key}
          column={column}
          columnIndex={index}
          density={density}
          dispatch={dispatch}
          drag={drag}
          now={now}
          row={row}
        />
      ))}
    </div>
  );
}

function RowHeader({ incoming, row }: { incoming: boolean; row: AreaRow }) {
  const { area } = row;

  return (
    <div
      className="sticky left-0 z-20 bg-surface-1"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0",
          incoming ? "bg-surface-3/70" : conditionRowTint[area.condition],
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          conditionRailTone[area.condition],
        )}
      />
      <div className="relative flex items-start gap-2.5 py-3 pr-3 pl-3.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-shadow",
            conditionIconTone[area.condition],
            incoming && "ring-2 ring-foreground/25",
          )}
        >
          <AreaIcon icon={area.icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-heading text-sm font-semibold tracking-tight">
              {area.name}
            </span>
            <span
              className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70"
              title={`${row.openCount} open Threads`}
            >
              {row.openCount}
            </span>
          </div>
          <RowStatus incoming={incoming} row={row} />
        </div>
      </div>
    </div>
  );
}

function RowStatus({ incoming, row }: { incoming: boolean; row: AreaRow }) {
  if (incoming) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-foreground">
        <CornerDownRight className="size-3" />
        Move to {row.area.name}
      </span>
    );
  }

  if (row.openCount === 0) {
    return (
      <span className="mt-0.5 block text-[11px] text-muted-foreground/50">
        No open Threads
      </span>
    );
  }

  if (row.hollow) {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <CircleDashed className="size-3" />
        Nothing planned
      </span>
    );
  }

  if (row.neglected) {
    return (
      <span
        className={cn(
          "mt-0.5 block text-[11px]",
          row.area.condition === "healthy"
            ? "text-muted-foreground/60"
            : "text-condition-attention",
        )}
      >
        Nothing this week
      </span>
    );
  }

  return (
    <span className="mt-0.5 block text-[11px] text-muted-foreground/60">
      {conditionLabels[row.area.condition]} ·{" "}
      <span className="tabular-nums">{row.plannedCount}</span> planned
    </span>
  );
}

/* ------------------------------------------------------------------ cell -- */

function GridCell({
  column,
  columnIndex,
  density,
  dispatch,
  drag,
  now,
  row,
}: {
  column: PlanColumn;
  columnIndex: number;
  density: Density;
  dispatch: (action: PlanAction) => void;
  drag: DragState | null;
  now: number;
  row: AreaRow;
}) {
  const droppable = column.drop !== null;
  const { isOver, setNodeRef } = useDroppable({
    id: `${row.area.id}::${column.key}`,
    data: { areaId: row.area.id, column: column.key } satisfies CellDropData,
    disabled: !droppable,
  });

  const threads = row.cells[column.key];
  const isSource = drag?.areaId === row.area.id && drag.column === column.key;
  const showHint = drag != null && droppable && !isSource;
  const showNudge =
    !drag &&
    column.key === "today" &&
    threads.length === 0 &&
    row.neglected &&
    row.area.condition !== "healthy";

  return (
    <div
      ref={setNodeRef}
      data-cell={`${row.area.id}::${column.key}`}
      style={{ gridColumn: columnIndex + 2, gridRow: 1 }}
      className={cn(
        "relative flex min-h-[3.5rem] flex-col gap-1 px-1.5 py-1.5",
        columnIndex === 0
          ? "border-l border-border"
          : "border-l border-border/35",
        column.key === "today" && "bg-surface-3/45",
      )}
    >
      {showHint && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-1 z-0 rounded-md border border-dashed transition-colors",
            isOver
              ? "border-foreground/25 bg-surface-3"
              : "border-border/70 bg-transparent",
          )}
        />
      )}

      <div className="relative z-10 flex flex-col gap-1">
        {threads.map((thread) => (
          <ThreadChip
            key={thread.id}
            area={mockAreaById.get(thread.areaId)}
            column={column.key}
            density={density}
            dispatch={dispatch}
            now={now}
            thread={thread}
          />
        ))}

        {showNudge && <PlanNudge dispatch={dispatch} now={now} row={row} />}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- nudge -- */

/**
 * The point of the whole direction: an Area that needs you and has nothing on
 * the near horizon gets an inline prompt to pull one of its Threads forward.
 */
function PlanNudge({
  dispatch,
  now,
  row,
}: {
  dispatch: (action: PlanAction) => void;
  now: number;
  row: AreaRow;
}) {
  const [open, setOpen] = useState(false);
  const candidates: MockThread[] = [
    ...row.cells.none,
    ...row.cells["next-week"],
    ...row.cells.later,
    ...row.cells.overdue,
  ];

  const base = startOfDay(new Date(now));
  const targets = [
    { label: "Today", at: base },
    { label: "Tomorrow", at: addDays(base, 1) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="h-7 w-full justify-start gap-1.5 rounded-md border border-dashed border-condition-attention/40 px-2 text-[11px] font-medium text-condition-attention hover:bg-condition-attention/10 hover:text-condition-attention"
          />
        }
      >
        <Sparkles className="size-3" />
        Plan something
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[19rem] gap-0 p-0">
        <header className="px-3.5 pt-3.5 pb-2.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <AreaIcon icon={row.area.icon} className="size-3" />
            {row.area.name}
          </span>
          <h3 className="mt-1 font-heading text-sm leading-snug font-semibold">
            Nothing here this week
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {conditionLabels[row.area.condition]} — pull one Thread onto the
            near horizon.
          </p>
        </header>

        <div className="max-h-64 overflow-y-auto border-t border-border/60">
          {candidates.length === 0 && (
            <p className="px-3.5 py-4 text-xs text-muted-foreground">
              No Threads left in this Area.
            </p>
          )}
          {candidates.map((thread) => (
            <div
              key={thread.id}
              className="flex items-center gap-2 border-b border-border/40 px-3.5 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {thread.title}
                </span>
                <span className="block text-[11px] text-muted-foreground/70">
                  {followUpLabel(thread.followUp, now)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                {targets.map((target) => (
                  <Button
                    key={target.label}
                    variant="outline"
                    size="xs"
                    className="rounded-lg"
                    onClick={() => {
                      dispatch({
                        followUp: new Date(
                          target.at.getFullYear(),
                          target.at.getMonth(),
                          target.at.getDate(),
                          9,
                        ).getTime(),
                        threadId: thread.id,
                        type: "set-follow-up",
                      });
                      setOpen(false);
                    }}
                  >
                    {target.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
