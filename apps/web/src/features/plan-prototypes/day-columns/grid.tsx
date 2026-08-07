import { conditionLabels } from "@convex/lib/condition";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { CircleDashed, CornerDownRight, Inbox, Sparkles } from "lucide-react";
import { useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { Density } from "./chip";
import type { AreaRow, ColumnKey, PlanColumn, PlanItem } from "./model";
import type { PlanAction } from "./plan-state";

import { PlanChip } from "./chip";
import {
  conditionIconTone,
  conditionRailTone,
  conditionRowTint,
  conditionShort,
  dateSentence,
  dayAt,
  INBOX_ROW_ID,
  NO_DATE_KEY,
} from "./model";

/** Sticky-left Area column. */
export const HEADER_WIDTH = 172;
/** Sticky-right "No date" column. */
export const NO_DATE_WIDTH = 128;
/**
 * Day columns are the whole point and also the whole cost: seven of them have
 * to fit next to two pinned edges. Compact is tuned so the whole week clears a
 * 1280px content box without scrolling; comfortable buys the width back and
 * lets the Next Move show, at the price of a horizontal scroll.
 *
 * Overdue and Beyond run wider than a day: their chips still have to print how
 * late, or how far off, they are.
 */
const DAY_WIDTH: Record<Density, number> = { comfortable: 158, compact: 110 };
const OVERDUE_WIDTH: Record<Density, number> = {
  comfortable: 132,
  compact: 100,
};
const BEYOND_WIDTH: Record<Density, number> = {
  comfortable: 146,
  compact: 114,
};

export interface DragState {
  column: ColumnKey;
  itemId: string;
  kind: PlanItem["kind"];
  overColumn?: ColumnKey;
  overRowId?: string;
  rowId: string;
}

export interface CellDropData {
  column: ColumnKey;
  rowId: string;
}

function columnWidth(column: PlanColumn, density: Density): number {
  switch (column.kind) {
    case "overdue":
      return OVERDUE_WIDTH[density];
    case "day":
      return DAY_WIDTH[density];
    case "beyond":
      return BEYOND_WIDTH[density];
    case "none":
      return NO_DATE_WIDTH;
  }
}

export function gridTemplate(columns: PlanColumn[], density: Density): string {
  const tracks = columns.map((column) => {
    const width = columnWidth(column, density);
    if (column.kind === "none") return `${width}px`;
    return `minmax(${width}px, ${column.kind === "day" ? "1fr" : "0.85fr"})`;
  });
  return `${HEADER_WIDTH}px ${tracks.join(" ")}`;
}

export function gridMinWidth(columns: PlanColumn[], density: Density): number {
  return columns.reduce(
    (total, column) => total + columnWidth(column, density),
    HEADER_WIDTH,
  );
}

/** Can this drag legally land here? Overdue is never a target — it is the past. */
export function isValidTarget(
  drag: DragState,
  rowId: string,
  column: PlanColumn,
): boolean {
  if (column.drop === null) return false;
  return drag.kind === "task" ? rowId === INBOX_ROW_ID : rowId !== INBOX_ROW_ID;
}

/* ------------------------------------------------------------- surfaces -- */

/** Today reads primary, the weekend reads quieter, everything else is plain. */
function columnSurface(column: PlanColumn): string {
  if (column.isToday) return "bg-surface-3/50";
  if (column.isWeekend) return "bg-foreground/[0.03]";
  return "";
}

function columnDivider(column: PlanColumn): string {
  if (column.kind === "none") return "border-l border-border";
  if (column.isToday || column.kind === "beyond") {
    return "border-l border-border/70";
  }
  return "border-l border-border/30";
}

function columnBarTone(column: PlanColumn): string {
  if (column.kind === "overdue") return "bg-condition-attention/70";
  if (column.isToday) return "bg-brand-accent-foreground";
  if (column.kind === "day") return "bg-foreground/22";
  return "bg-foreground/12";
}

/* ------------------------------------------------------------- header row -- */

export function ColumnHeaderRow({
  areaCount,
  columns,
  density,
  totals,
}: {
  areaCount: number;
  columns: PlanColumn[];
  density: Density;
  totals: Record<ColumnKey, number>;
}) {
  const peak = Math.max(1, ...columns.map((column) => totals[column.key] ?? 0));

  return (
    <div
      className="grid w-full border-b border-border bg-surface-1"
      style={{ gridTemplateColumns: gridTemplate(columns, density) }}
    >
      <div className="sticky left-0 z-30 flex flex-col justify-end gap-1.5 border-r border-border bg-surface-1 px-3.5 pt-1.5 pb-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          <span className="tabular-nums">{areaCount}</span>{" "}
          {areaCount === 1 ? "Area" : "Areas"}
        </span>
        <span className="h-[3px]" />
      </div>

      {columns.map((column) => {
        const count = totals[column.key] ?? 0;
        const isNoDate = column.kind === "none";

        return (
          <div
            key={column.key}
            className={cn(
              "relative flex flex-col gap-1.5 px-2 pt-1.5 pb-2",
              columnDivider(column),
              columnSurface(column),
              isNoDate && "sticky right-0 z-30 bg-surface-1",
            )}
          >
            {column.isToday && (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[2px] bg-brand-accent-foreground"
              />
            )}

            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "truncate text-[10px] font-semibold tracking-[0.06em] uppercase",
                  column.kind === "overdue" && "text-condition-attention",
                  column.isToday && "text-brand-accent-foreground",
                  !column.isToday &&
                    column.kind === "day" &&
                    (column.isWeekend
                      ? "text-muted-foreground/55"
                      : "text-muted-foreground"),
                  (column.kind === "beyond" || isNoDate) &&
                    "text-muted-foreground/70",
                )}
              >
                {column.label}
              </span>
              {column.dayNumber && (
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold tabular-nums",
                    column.isToday
                      ? "text-foreground"
                      : column.isWeekend
                        ? "text-muted-foreground/60"
                        : "text-foreground/70",
                  )}
                >
                  {column.dayNumber}
                </span>
              )}
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                {count}
              </span>
            </div>

            <div className="h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
              <div
                className={cn("h-full rounded-full", columnBarTone(column))}
                style={{ width: `${(count / peak) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- rows -- */

interface RowChrome {
  columns: PlanColumn[];
  density: Density;
  dispatch: (action: PlanAction) => void;
  drag: DragState | null;
  now: number;
  onSelect: (id: string) => void;
  selectedId?: string;
}

export function AreaGridRow({
  chrome,
  row,
}: {
  chrome: RowChrome;
  row: AreaRow;
}) {
  const { drag } = chrome;
  const incoming =
    drag != null &&
    drag.kind === "thread" &&
    drag.overRowId === row.area.id &&
    drag.rowId !== row.area.id;

  const tint = conditionRowTint[row.area.condition];

  return (
    <div
      className={cn(
        "group/row relative grid w-full border-b border-border/50 bg-surface-1 transition-colors",
        incoming && "ring-1 ring-foreground/20 ring-inset",
      )}
      style={{
        gridTemplateColumns: gridTemplate(chrome.columns, chrome.density),
      }}
    >
      {/* The condition tint is an overlay, not a background class: the pinned
          cells need an opaque `bg-surface-1` of their own, and a second
          background utility would simply replace it. */}
      <Tint className={tint} />

      <AreaRowHeader incoming={incoming} row={row} />

      {chrome.columns.map((column, index) => (
        <GridCell
          key={column.key}
          cellItems={row.cells[column.key] ?? []}
          chrome={chrome}
          column={column}
          columnIndex={index}
          nudge={
            column.isToday &&
            row.nearHorizon === 0 &&
            row.openCount > 0 &&
            row.area.condition !== "healthy"
              ? row
              : undefined
          }
          rowId={row.area.id}
          tint={tint}
        />
      ))}
    </div>
  );
}

/** A translucent condition wash that sits under everything in its container. */
function Tint({ className }: { className: string }) {
  if (className === "") return null;
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    />
  );
}

function AreaRowHeader({ incoming, row }: { incoming: boolean; row: AreaRow }) {
  const { area } = row;

  return (
    <div
      className="sticky left-0 z-20 border-r border-border bg-surface-1"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      <Tint className={conditionRowTint[area.condition]} />
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          conditionRailTone[area.condition],
        )}
      />
      <div className="relative flex items-start gap-2 py-2.5 pr-2.5 pl-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg transition-shadow",
            conditionIconTone[area.condition],
            incoming && "ring-2 ring-foreground/30",
          )}
        >
          <AreaIcon icon={area.icon} className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1.5">
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
          <AreaRowStatus incoming={incoming} row={row} />
        </div>
      </div>
    </div>
  );
}

function AreaRowStatus({ incoming, row }: { incoming: boolean; row: AreaRow }) {
  if (incoming) {
    return (
      <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-foreground">
        <CornerDownRight className="size-3 shrink-0" />
        Move here
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

  if (row.plannedCount === 0) {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <CircleDashed className="size-3 shrink-0" />
        Nothing planned
      </span>
    );
  }

  if (row.nearHorizon === 0) {
    return (
      <span
        className={cn(
          "mt-0.5 block text-[11px]",
          row.area.condition === "healthy"
            ? "text-muted-foreground/60"
            : "font-medium text-condition-attention",
        )}
      >
        Nothing this week
      </span>
    );
  }

  return (
    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/60">
      {conditionShort[row.area.condition]} ·{" "}
      <span className="tabular-nums">{row.plannedCount}</span> planned
    </span>
  );
}

/* ----------------------------------------------------------- inbox row -- */

export function InboxGridRow({
  cells,
  chrome,
  taskCount,
}: {
  cells: Record<ColumnKey, PlanItem[]>;
  chrome: RowChrome;
  taskCount: number;
}) {
  return (
    <div
      className="relative grid w-full border-t-2 border-border bg-surface-1"
      style={{
        gridTemplateColumns: gridTemplate(chrome.columns, chrome.density),
      }}
    >
      <div
        className="sticky left-0 z-20 border-r border-border bg-surface-1"
        style={{ gridColumn: 1, gridRow: 1 }}
      >
        <div className="relative flex items-start gap-2 py-2.5 pr-2.5 pl-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-muted-foreground">
            <Inbox className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1.5">
              <span className="truncate font-heading text-sm font-semibold tracking-tight">
                Inbox
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                {taskCount}
              </span>
            </div>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/60">
              Tasks · no Area
            </span>
          </div>
        </div>
      </div>

      {chrome.columns.map((column, index) => (
        <GridCell
          key={column.key}
          cellItems={cells[column.key] ?? []}
          chrome={chrome}
          column={column}
          columnIndex={index}
          rowId={INBOX_ROW_ID}
          tint=""
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ cell -- */

function GridCell({
  cellItems,
  chrome,
  column,
  columnIndex,
  nudge,
  rowId,
  tint,
}: {
  cellItems: PlanItem[];
  chrome: RowChrome;
  column: PlanColumn;
  columnIndex: number;
  nudge?: AreaRow;
  rowId: string;
  tint: string;
}) {
  const { density, dispatch, drag, now, onSelect, selectedId } = chrome;
  const valid = drag != null && isValidTarget(drag, rowId, column);

  // Every cell registers as a droppable, including the ones that refuse the
  // drop: knowing *why* a target is closed is worth more than silence.
  const { isOver, setNodeRef } = useDroppable({
    id: `${rowId}::${column.key}`,
    data: { column: column.key, rowId } satisfies CellDropData,
  });

  const isSource = drag?.rowId === rowId && drag.column === column.key;
  const isNoDate = column.kind === "none";

  return (
    <div
      ref={setNodeRef}
      data-cell={`${rowId}::${column.key}`}
      style={{ gridColumn: columnIndex + 2, gridRow: 1 }}
      className={cn(
        "relative flex min-h-[3.25rem] flex-col gap-1 px-1 py-1.5",
        columnDivider(column),
        columnSurface(column),
        isNoDate && "sticky right-0 z-20 bg-surface-1",
      )}
    >
      {isNoDate && <Tint className={tint} />}

      {valid && !isSource && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0.5 z-0 rounded-md border border-dashed transition-colors",
            isOver
              ? "border-foreground/35 bg-surface-3"
              : "border-border/70 bg-transparent",
          )}
        />
      )}

      <div className="relative z-10 flex flex-col gap-1">
        {cellItems.map((item) => (
          <PlanChip
            key={item.id}
            column={column}
            density={density}
            item={item}
            now={now}
            onSelect={onSelect}
            rowId={rowId}
            selected={item.id === selectedId}
          />
        ))}

        {nudge && !drag && (
          <PlanNudge dispatch={dispatch} now={now} row={nudge} />
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- nudge -- */

/**
 * The point of the whole canvas: an Area that needs you and has nothing in the
 * visible week gets an inline prompt to pull one of its Threads forward. In a
 * day-wide column it earns its place as a one-word target, not a sentence.
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
  const candidates = [
    ...(row.cells[NO_DATE_KEY] ?? []),
    ...(row.cells.overdue ?? []),
    ...(row.cells.beyond ?? []),
  ];

  const targets = [
    { at: dayAt(0, now, 17), label: "Today" },
    { at: dayAt(1, now), label: "Tomorrow" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="h-6 w-full justify-center gap-1 rounded-md border border-dashed border-condition-attention/45 px-1 text-[11px] font-medium text-condition-attention hover:bg-condition-attention/10 hover:text-condition-attention"
          />
        }
      >
        <Sparkles className="size-3 shrink-0" />
        Plan
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[20rem] gap-0 p-0">
        <header className="flex items-center gap-1.5 px-3.5 pt-3 pb-2.5 text-[11px] text-muted-foreground">
          <AreaIcon icon={row.area.icon} className="size-3" />
          {row.area.name}
          <span aria-hidden>·</span>
          {conditionLabels[row.area.condition]}
        </header>

        <div className="max-h-64 overflow-y-auto border-t border-border/60">
          {candidates.length === 0 && (
            <p className="px-3.5 py-4 text-xs text-muted-foreground">
              No Threads left in this Area.
            </p>
          )}
          {candidates.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 border-b border-border/40 px-3.5 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {item.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground/70">
                  {dateSentence(item, now).text}
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
                        date: target.at,
                        itemId: item.id,
                        type: "set-date",
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
