import { conditionLabels } from "@convex/lib/condition";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import {
  ChevronsLeftRight,
  ChevronsRightLeft,
  CircleDashed,
  CornerDownRight,
  Inbox,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { Density } from "./chip";
import type {
  AreaRow,
  ColumnKey,
  DaySlot,
  PlanColumn,
  PlanItem,
} from "./model";
import type { PlanAction } from "./plan-state";

import { ChipSurface, PlanChip } from "./chip";
import {
  columnBarTone,
  columnLabelTone,
  conditionIconTone,
  conditionRailTone,
  conditionRowTint,
  conditionShort,
  dateSentence,
  dayAt,
  INBOX_ROW_ID,
  slotIndexFor,
} from "./model";

/** Sticky-left Area column. */
export const HEADER_WIDTH = 178;
const MIN_COLUMN_WIDTH = 110;
/** How wide a column gets *per day* once it zooms open. */
const SLOT_WIDTH = 40;
/** What a neighbour column shrinks to while something else is zoomed. */
const COMPRESSED_WIDTH = 74;
/** Sticky-right "No date" column. */
export const NO_DATE_WIDTH = 146;
/** Reserved strip in a zoomed `Later` cell for items outside the shown week. */
const RESIDUE_WIDTH = 14;

/** A column currently zoomed open into its individual days. */
export interface Expansion {
  key: ColumnKey;
  /** Held open by a header click (as opposed to by the drag under way). */
  pinned: boolean;
  slots: DaySlot[];
}

export interface DragState {
  column: ColumnKey;
  itemId: string;
  kind: PlanItem["kind"];
  /** The exact day under the pointer, when the pointer is on a day slot. */
  overAt?: number;
  overColumn?: ColumnKey;
  overRowId?: string;
  rowId: string;
}

export interface CellDropData {
  column: ColumnKey;
  /** The date this target writes. Undefined on `No date`, which clears. */
  dropAt?: number;
  rowId: string;
  /** Present only on a per-day slot. */
  slot?: number;
}

/** The `Later` header's week picker doubles as a hover target while dragging. */
export interface WeekDropData {
  laterWeek: number;
}

export function gridTemplate(
  columns: PlanColumn[],
  expansion: Expansion | null,
): string {
  // Every track keeps the same `minmax(px, fr)` shape in both states so the
  // browser can interpolate the template instead of snapping it.
  const tracks = columns.map((column) => {
    if (column.key === "none") return `${NO_DATE_WIDTH}px`;
    if (!expansion) return `minmax(${MIN_COLUMN_WIDTH}px, 1fr)`;
    if (column.key === expansion.key) {
      const days = expansion.slots.length;
      const width =
        days * SLOT_WIDTH + (expansion.key === "later" ? RESIDUE_WIDTH : 0);
      // Enough extra weight to give every day a legible slot, and no more:
      // the neighbours squeeze, they do not collapse.
      const weight = Math.max(1, days * 0.36).toFixed(2);
      return `minmax(${width}px, ${weight}fr)`;
    }
    return `minmax(${COMPRESSED_WIDTH}px, 1fr)`;
  });

  return `${HEADER_WIDTH}px ${tracks.join(" ")}`;
}

/**
 * The canvas keeps one width across both states: zooming a column never
 * changes how far the board scrolls, it only redistributes the space.
 */
export function gridMinWidth(columnCount: number): number {
  return HEADER_WIDTH + (columnCount - 1) * MIN_COLUMN_WIDTH + NO_DATE_WIDTH;
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

const gridMotion = "transition-[grid-template-columns] duration-150 ease-out";

/* ------------------------------------------------------------- header row -- */

export function ColumnHeaderRow({
  areaCount,
  columns,
  expansion,
  laterWeek,
  onFocusWeek,
  onToggleColumn,
  totals,
  weeks,
}: {
  areaCount: number;
  columns: PlanColumn[];
  expansion: Expansion | null;
  laterWeek: number;
  onFocusWeek: (index: number) => void;
  onToggleColumn: (key: ColumnKey) => void;
  totals: Record<ColumnKey, number>;
  weeks: { index: number; label: string }[];
}) {
  const peak = Math.max(1, ...columns.map((column) => totals[column.key]));

  return (
    <div
      className={cn(
        "grid w-full border-b border-border bg-surface-1",
        gridMotion,
      )}
      style={{ gridTemplateColumns: gridTemplate(columns, expansion) }}
    >
      <div className="sticky left-0 z-30 flex flex-col gap-1.5 border-r border-border bg-surface-1 px-3.5 pt-1 pb-2">
        <span className="flex h-4 items-center text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          <span className="tabular-nums">{areaCount}</span>
          <span className="ml-1">{areaCount === 1 ? "Area" : "Areas"}</span>
        </span>
        <span className="h-[24px]" />
      </div>

      {columns.map((column) => {
        const isNoDate = column.key === "none";
        const zoomed = expansion?.key === column.key;
        const splittable = column.span > 1;

        return (
          <div
            key={column.key}
            className={cn(
              "flex flex-col gap-1.5 pt-1 pb-2",
              zoomed ? "px-1.5" : "px-2.5",
              isNoDate
                ? "sticky right-0 z-30 border-l border-border bg-surface-1"
                : "border-l border-border/35",
              column.key === "today" && "bg-surface-3/45",
              zoomed && "bg-surface-3/30",
            )}
          >
            <div className="flex h-4 items-center gap-1.5">
              <button
                type="button"
                disabled={!splittable}
                aria-pressed={splittable ? zoomed : undefined}
                onClick={() => onToggleColumn(column.key)}
                className={cn(
                  "flex min-w-0 items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  splittable && "cursor-pointer hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "truncate text-[11px] leading-none font-semibold tracking-[0.06em] uppercase",
                    columnLabelTone[column.tone],
                    zoomed && "text-foreground",
                  )}
                >
                  {column.label}
                </span>
                <span className="text-[11px] leading-none tabular-nums text-muted-foreground/70">
                  {totals[column.key]}
                </span>
                {splittable &&
                  (zoomed ? (
                    <ChevronsRightLeft
                      aria-hidden
                      className="size-2.5 shrink-0 text-foreground/70"
                    />
                  ) : (
                    <ChevronsLeftRight
                      aria-hidden
                      className="size-2.5 shrink-0 text-muted-foreground/40"
                    />
                  ))}
              </button>

              {zoomed && column.key === "later" && (
                <div className="ml-auto flex items-center gap-0.5">
                  {weeks.map((week) => (
                    <WeekChip
                      key={week.index}
                      active={week.index === laterWeek}
                      label={week.label}
                      onSelect={onFocusWeek}
                      week={week.index}
                    />
                  ))}
                </div>
              )}
            </div>

            {zoomed && expansion ? (
              <div className="flex h-[24px] items-stretch">
                {column.key === "later" && (
                  <span style={{ width: RESIDUE_WIDTH }} className="shrink-0" />
                )}
                <div className="flex min-w-0 flex-1 divide-x divide-border/20">
                  {expansion.slots.map((slot) => (
                    <span
                      key={slot.delta}
                      className={cn(
                        "flex min-w-0 flex-1 flex-col items-center justify-center leading-[11px]",
                        slot.weekend
                          ? "text-muted-foreground/55"
                          : "text-muted-foreground",
                      )}
                    >
                      <span className="text-[9px] font-medium">
                        {slot.label}
                      </span>
                      <span className="text-[10px] font-semibold tabular-nums text-foreground/80">
                        {slot.number}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[24px] flex-col gap-1.5">
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      columnBarTone[column.tone],
                    )}
                    style={{ width: `${(totals[column.key] / peak) * 100}%` }}
                  />
                </div>
                <span className="truncate text-[10px] leading-[15px] text-muted-foreground/60">
                  {column.caption}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A week of the open-ended `Later` horizon.
 *
 * It is a droppable as well as a button: mid-drag you slide over it to bring
 * that week's days into the column, then drop on the day you want.
 */
function WeekChip({
  active,
  label,
  onSelect,
  week,
}: {
  active: boolean;
  label: string;
  onSelect: (index: number) => void;
  week: number;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `later-week::${week}`,
    data: { laterWeek: week } satisfies WeekDropData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(week)}
      className={cn(
        "rounded-full px-1.5 py-px text-[9px] leading-[13px] font-medium whitespace-nowrap tabular-nums transition-colors",
        active
          ? "bg-foreground text-surface-1"
          : "bg-surface-3 text-muted-foreground hover:text-foreground",
        isOver && !active && "bg-foreground/25 text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/* ---------------------------------------------------------------- rows -- */

interface RowChrome {
  columns: PlanColumn[];
  density: Density;
  dispatch: (action: PlanAction) => void;
  drag: DragState | null;
  expansion: Expansion | null;
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
        gridMotion,
        incoming && "ring-1 ring-foreground/20 ring-inset",
      )}
      style={{
        gridTemplateColumns: gridTemplate(chrome.columns, chrome.expansion),
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
          cellItems={row.cells[column.key]}
          chrome={chrome}
          column={column}
          columnIndex={index}
          nudge={
            column.key === "today" &&
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
      <div className="relative flex items-start gap-2.5 py-2.5 pr-3 pl-3.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-shadow",
            conditionIconTone[area.condition],
            incoming && "ring-2 ring-foreground/30",
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
          <AreaRowStatus incoming={incoming} row={row} />
        </div>
      </div>
    </div>
  );
}

function AreaRowStatus({ incoming, row }: { incoming: boolean; row: AreaRow }) {
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

  if (row.plannedCount === 0) {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <CircleDashed className="size-3" />
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
      className={cn(
        "relative grid w-full border-t-2 border-border bg-surface-1",
        gridMotion,
      )}
      style={{
        gridTemplateColumns: gridTemplate(chrome.columns, chrome.expansion),
      }}
    >
      <div
        className="sticky left-0 z-20 border-r border-border bg-surface-1"
        style={{ gridColumn: 1, gridRow: 1 }}
      >
        <div className="relative flex items-start gap-2.5 py-2.5 pr-3 pl-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-muted-foreground">
            <Inbox className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
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
          cellItems={cells[column.key]}
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
  const { expansion } = chrome;

  if (expansion?.key === column.key) {
    return (
      <ZoomedCell
        cellItems={cellItems}
        chrome={chrome}
        column={column}
        columnIndex={columnIndex}
        expansion={expansion}
        rowId={rowId}
      />
    );
  }

  return (
    <PlainCell
      cellItems={cellItems}
      chrome={chrome}
      column={column}
      columnIndex={columnIndex}
      nudge={nudge}
      rowId={rowId}
      tint={tint}
    />
  );
}

function PlainCell({
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
  const { density, dispatch, drag, expansion, now, onSelect, selectedId } =
    chrome;
  const valid = drag != null && isValidTarget(drag, rowId, column);

  // Every cell registers as a droppable, including the ones that refuse the
  // drop: knowing *why* a target is closed is worth more than silence.
  const { isOver, setNodeRef } = useDroppable({
    id: `${rowId}::${column.key}`,
    data: {
      column: column.key,
      dropAt: column.dropAt,
      rowId,
    } satisfies CellDropData,
  });

  const isSource = drag?.rowId === rowId && drag.column === column.key;
  const isNoDate = column.key === "none";
  const squeezed = expansion != null && !isNoDate;

  return (
    <div
      ref={setNodeRef}
      data-cell={`${rowId}::${column.key}`}
      style={{ gridColumn: columnIndex + 2, gridRow: 1 }}
      className={cn(
        "relative flex min-h-[3.25rem] flex-col gap-1 py-1.5",
        squeezed ? "px-1" : "px-1.5",
        isNoDate
          ? "sticky right-0 z-20 border-l border-border bg-surface-1"
          : "border-l border-border/35",
        column.key === "today" && "bg-surface-3/45",
      )}
    >
      {isNoDate && <Tint className={tint} />}

      {valid && !isSource && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-1 z-0 rounded-md border border-dashed transition-colors",
            isOver
              ? "border-foreground/30 bg-surface-3"
              : "border-border/70 bg-transparent",
          )}
        />
      )}

      <div className="relative z-10 flex flex-col gap-1">
        {cellItems.map((item) => (
          <PlanChip
            key={item.id}
            column={column.key}
            density={density}
            item={item}
            now={now}
            onSelect={onSelect}
            rowId={rowId}
            selected={item.id === selectedId}
          />
        ))}

        {nudge && !drag && !expansion && (
          <PlanNudge dispatch={dispatch} now={now} row={nudge} />
        )}
      </div>
    </div>
  );
}

/**
 * A column zoomed into its days.
 *
 * The lane must not move while this happens, so the collapsed chip stack stays
 * in the flow as an invisible height ghost and the day slots are laid over it.
 * The cell is therefore exactly as tall zoomed as it was collapsed — no matter
 * how the items redistribute across the days.
 */
function ZoomedCell({
  cellItems,
  chrome,
  column,
  columnIndex,
  expansion,
  rowId,
}: {
  cellItems: PlanItem[];
  chrome: RowChrome;
  column: PlanColumn;
  columnIndex: number;
  expansion: Expansion;
  rowId: string;
}) {
  const { density, drag, now, onSelect, selectedId } = chrome;
  const valid = drag != null && isValidTarget(drag, rowId, column);

  const perSlot: PlanItem[][] = expansion.slots.map(() => []);
  const residue: PlanItem[] = [];
  for (const item of cellItems) {
    const index = slotIndexFor(item.date, expansion.slots, now);
    if (index < 0) residue.push(item);
    else perSlot[index].push(item);
  }

  return (
    <div
      data-cell={`${rowId}::${column.key}`}
      style={{ gridColumn: columnIndex + 2, gridRow: 1 }}
      className="relative flex min-h-[3.25rem] flex-col border-l border-border/35 bg-surface-3/30 px-1.5 py-1.5"
    >
      <div aria-hidden className="invisible flex flex-col gap-1">
        {cellItems.map((item) => (
          <ChipSurface
            key={item.id}
            column={column.key}
            density={density}
            item={item}
            now={now}
          />
        ))}
      </div>

      <div className="absolute inset-1.5 flex items-stretch">
        {column.key === "later" && (
          <ResidueStrip items={residue} now={now} onSelect={onSelect} />
        )}
        <div className="flex min-w-0 flex-1 items-stretch divide-x divide-border/20">
          {expansion.slots.map((slot, index) => (
            <DaySlotCell
              key={slot.delta}
              column={column}
              items={perSlot[index]}
              now={now}
              onSelect={onSelect}
              rowId={rowId}
              selectedId={selectedId}
              slot={slot}
              slotIndex={index}
              valid={valid}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DaySlotCell({
  column,
  items,
  now,
  onSelect,
  rowId,
  selectedId,
  slot,
  slotIndex,
  valid,
}: {
  column: PlanColumn;
  items: PlanItem[];
  now: number;
  onSelect: (id: string) => void;
  rowId: string;
  selectedId?: string;
  slot: DaySlot;
  slotIndex: number;
  valid: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${rowId}::${column.key}::${slot.delta}`,
    data: {
      column: column.key,
      dropAt: slot.at,
      rowId,
      slot: slotIndex,
    } satisfies CellDropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col gap-1 px-px",
        slot.weekend && "bg-foreground/[0.035]",
      )}
    >
      {valid && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-px inset-y-0 z-0 rounded-[4px] border border-dashed transition-colors",
            isOver
              ? "border-foreground/40 bg-surface-3"
              : "border-border/50 bg-transparent",
          )}
        />
      )}

      <div className="relative z-10 flex flex-col gap-1">
        {items.map((item) => (
          <PlanChip
            key={item.id}
            column={column.key}
            density="compact"
            item={item}
            mini
            now={now}
            onSelect={onSelect}
            rowId={rowId}
            selected={item.id === selectedId}
          />
        ))}
      </div>

      {isOver && valid && (
        <span className="pointer-events-none absolute -bottom-1 left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground px-1.5 py-px text-[9px] leading-[13px] font-medium whitespace-nowrap text-surface-1 shadow-sm">
          {slot.label} {slot.number}
        </span>
      )}
    </div>
  );
}

/**
 * `Later` runs forever, so a zoom can only show one week of it at a time.
 * Whatever sits in the other weeks stays visible as a residue rail rather than
 * disappearing while you plan.
 */
function ResidueStrip({
  items,
  now,
  onSelect,
}: {
  items: PlanItem[];
  now: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{ width: RESIDUE_WIDTH }}
      className="flex shrink-0 flex-col gap-1 pr-1"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={`${item.title} — another week of Later`}
          onClick={() => onSelect(item.id)}
          className="h-[26px] w-full shrink-0 rounded-sm bg-foreground/12 outline-none hover:bg-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span className="sr-only">
            {item.title} — {dateSentence(item, now).text}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- nudge -- */

/**
 * The point of the whole canvas: an Area that needs you and has nothing on the
 * near horizon gets an inline prompt to pull one of its Threads forward.
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
    ...row.cells.none,
    ...row.cells.overdue,
    ...row.cells["next-week"],
    ...row.cells.later,
  ];

  const targets = [
    { label: "Today", at: dayAt(0, now, 17) },
    { label: "Tomorrow", at: dayAt(1, now) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="h-7 w-full justify-start gap-1.5 rounded-md border border-dashed border-condition-attention/45 px-2 text-[11px] font-medium text-condition-attention hover:bg-condition-attention/10 hover:text-condition-attention"
          />
        }
      >
        <Sparkles className="size-3" />
        Plan something
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
