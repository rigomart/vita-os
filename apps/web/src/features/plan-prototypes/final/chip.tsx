import { useDraggable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { CornerDownRight, Inbox } from "lucide-react";

import type { ColumnKey, PlanItem } from "./model";

import { agoLabel, chipStamp } from "./model";

export type Density = "comfortable" | "compact";

export interface ChipDragData {
  column: ColumnKey;
  itemId: string;
  kind: PlanItem["kind"];
  rowId: string;
}

/** Left rail colour, mirroring the attention-list rail tones. */
const railTone: Partial<Record<ColumnKey, string>> = {
  overdue: "bg-condition-attention",
  today: "bg-brand-accent-foreground",
};

const surfaceTone: Partial<Record<ColumnKey, string>> = {
  overdue: "border-condition-attention/30 bg-condition-attention/8",
  today: "border-border bg-surface-2",
};

/**
 * Presentation only — shared by the in-grid chip and the drag ghost so the
 * lifted item is pixel-identical to the one it left behind.
 */
export function ChipSurface({
  column,
  density,
  item,
  lifted,
  now,
  selected,
}: {
  column: ColumnKey;
  density: Density;
  item: PlanItem;
  lifted?: boolean;
  now: number;
  selected?: boolean;
}) {
  const isTask = item.kind === "task";
  const stamp = chipStamp(item.date, column, now);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border py-1 pr-1.5 pl-2.5 text-left transition-colors",
        isTask
          ? "border-dashed border-border bg-surface-2/50 pl-2 hover:bg-surface-3/60"
          : cn(
              "border-border/70 bg-surface-2 hover:border-border hover:bg-surface-3/60",
              surfaceTone[column],
            ),
        lifted &&
          "border-border bg-surface-2 shadow-lg ring-1 ring-foreground/10",
        selected &&
          "border-ring/60 bg-surface-3 ring-2 ring-ring/40 hover:bg-surface-3",
      )}
    >
      {!isTask && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-0 w-[3px] rounded-r-full",
            railTone[column] ?? "bg-border",
          )}
        />
      )}

      <div className="flex items-start gap-1.5">
        {isTask && (
          <Inbox
            aria-hidden
            className="mt-[3px] size-3 shrink-0 text-muted-foreground/50"
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 text-xs leading-snug",
            density === "compact" ? "truncate" : "line-clamp-2",
            isTask ? "font-normal text-foreground/90" : "font-medium",
          )}
        >
          {item.title}
        </span>
        {stamp && (
          <span
            className={cn(
              "mt-px shrink-0 text-[10px] tabular-nums",
              column === "overdue"
                ? "font-medium text-condition-attention"
                : "text-muted-foreground/60",
            )}
          >
            {stamp}
          </span>
        )}
      </div>

      {density === "comfortable" && !isTask && (
        <span className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug">
          {item.nextMove ? (
            <>
              <CornerDownRight className="mt-[3px] size-2.5 shrink-0 text-muted-foreground/50" />
              <span className="truncate text-muted-foreground">
                {item.nextMove}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground/45">No Next Move</span>
          )}
        </span>
      )}

      {density === "comfortable" && isTask && item.createdAt != null && (
        <span className="mt-0.5 block pl-4.5 text-[11px] leading-snug text-muted-foreground/45">
          Captured {agoLabel(item.createdAt, now)}
        </span>
      )}
    </div>
  );
}

/**
 * A chip in the grid.
 *
 * Click — or Enter/Space while focused — opens the rail. Dragging is
 * pointer-only (see the sensor note in `index.tsx`), so the keyboard never
 * has to fight dnd-kit for the Enter key.
 */
export function PlanChip({
  column,
  density,
  item,
  now,
  onSelect,
  rowId,
  selected,
}: {
  column: ColumnKey;
  density: Density;
  item: PlanItem;
  now: number;
  onSelect: (id: string) => void;
  rowId: string;
  selected: boolean;
}) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: item.id,
    data: {
      column,
      itemId: item.id,
      kind: item.kind,
      rowId,
    } satisfies ChipDragData,
  });

  const hint =
    item.kind === "thread" && item.nextMove
      ? `Next Move: ${item.nextMove}`
      : undefined;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      data-chip={item.id}
      title={hint}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      className={cn(
        "w-full cursor-grab touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <ChipSurface
        column={column}
        density={density}
        item={item}
        now={now}
        selected={selected}
      />
    </button>
  );
}
