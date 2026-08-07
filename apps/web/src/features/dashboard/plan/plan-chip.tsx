import { useDraggable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { CornerDownRight, Inbox } from "lucide-react";

import type { Density, PlanItem } from "./plan-model";

import { agoLabel, waitingLabel } from "./plan-model";

export interface ChipDragData {
  itemId: string;
  kind: PlanItem["kind"];
  laneId: string;
  slotKey: string;
}

/**
 * Presentation only — shared by the in-lane chip and the drag ghost so the
 * lifted item is pixel-identical to the one it left behind.
 *
 * The axis already says *when*, so a chip on a day carries no date stamp. The
 * two slots where position cannot say it — the waiting bay and No date — are
 * the only ones that print anything.
 */
export function ChipSurface({
  density,
  item,
  lifted,
  now,
  slotKey,
}: {
  density: Density;
  item: PlanItem;
  lifted?: boolean;
  now: number;
  slotKey: string;
}) {
  const isTask = item.kind === "task";
  const waiting = slotKey === "overdue" && item.date != null;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border py-1 pr-1.5 pl-2 text-left transition-colors",
        isTask
          ? "border-dashed border-border bg-surface-2/60 hover:bg-surface-3/60"
          : "border-border/70 bg-surface-2 hover:border-border hover:bg-surface-3/60",
        !isTask &&
          waiting &&
          "border-condition-attention/30 bg-condition-attention/8",
        lifted &&
          "border-border bg-surface-2 shadow-lg ring-1 ring-foreground/10",
      )}
    >
      {!isTask && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-0 w-[3px] rounded-r-full",
            waiting ? "bg-condition-attention" : "bg-border",
          )}
        />
      )}

      <div className="flex items-start gap-1.5 pl-1">
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
        {waiting && (
          <span className="mt-px shrink-0 text-[10px] font-medium tabular-nums text-condition-attention">
            {waitingLabel(item.date!, now)}
          </span>
        )}
      </div>

      {density === "comfortable" && !isTask && (
        <span className="mt-0.5 flex items-start gap-1 pl-1 text-[11px] leading-snug">
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
        <span className="mt-0.5 block pl-5.5 text-[11px] leading-snug text-muted-foreground/45">
          Captured {agoLabel(item.createdAt, now)}
        </span>
      )}
    </div>
  );
}

/**
 * A chip sitting on its day.
 *
 * Click — or Enter/Space while focused — opens the Thread rail in place; a Task
 * chip goes to the Inbox, the only place a Task can be edited. Dragging is
 * pointer-only (see the sensor note in `plan-canvas.tsx`), so the keyboard
 * never has to fight dnd-kit for the Enter key, and dnd-kit swallows the click
 * that follows a real drag.
 */
export function PlanChip({
  density,
  item,
  now,
  onOpen,
  laneId,
  slotKey,
}: {
  density: Density;
  item: PlanItem;
  laneId: string;
  now: number;
  onOpen: (item: PlanItem) => void;
  slotKey: string;
}) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: item.id,
    data: {
      itemId: item.id,
      kind: item.kind,
      laneId,
      slotKey,
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
      onClick={() => onOpen(item)}
      className={cn(
        "w-full cursor-grab touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <ChipSurface density={density} item={item} now={now} slotKey={slotKey} />
    </button>
  );
}
