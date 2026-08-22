import { useDraggable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { ArrowRight, Bell, Inbox } from "lucide-react";

import type { Density, PlanItem } from "./plan-model";

import { agoLabel, dayCaption, waitingLabel } from "./plan-model";

/** The Next Move is the one thing a Thread surfaces outside its detail view
 * (ADR 0010), so it keeps the lead font weight; the title sits above it as a
 * muted identifier line. An empty slot prints a faint placeholder — a valid
 * state, so it reads neutral, never as a warning. */
export const NO_NEXT_MOVE = "No Next Move";

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
 * The axis already says *when*, so a chip on a day carries no date stamp. Off
 * the axis is where position cannot say it: the waiting bay prints how long the
 * debt has run, the Later rail prints the day itself — it stands for every date
 * past the end of the axis — and No date has nothing to print.
 *
 * Only the waiting badge wears the bell glyph: overdue is the one state loud
 * enough to earn it. Elsewhere the placement speaks for itself — the hover
 * hint spells out that a Thread's day is a Follow-up, not a commitment.
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
  const beyond = slotKey === "beyond" && item.date != null;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border text-left transition-colors",
        density === "compact" ? "py-1 pr-1.5 pl-2" : "py-1.5 pr-2 pl-2.5",
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

      {!isTask && (
        <span className="mb-0.5 block min-w-0 truncate text-xs leading-snug font-semibold text-muted-foreground">
          {item.title}
        </span>
      )}

      <div className="flex items-start gap-1.5">
        {isTask ? (
          <Inbox
            aria-hidden
            className="mt-[3px] size-3.5 shrink-0 text-muted-foreground/50"
          />
        ) : (
          <ArrowRight
            aria-hidden
            className={cn(
              "mt-[3px] size-3.5 shrink-0",
              item.nextMove
                ? "text-muted-foreground/50"
                : "text-muted-foreground/40",
            )}
          />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 text-sm leading-snug",
            density === "compact" ? "truncate" : "line-clamp-2",
            isTask && "font-normal text-foreground/90",
            !isTask &&
              (item.nextMove ? "font-medium" : "text-muted-foreground/45"),
          )}
        >
          {isTask ? item.title : (item.nextMove ?? NO_NEXT_MOVE)}
        </span>
        {waiting && (
          <span className="mt-px flex shrink-0 items-center gap-0.5 text-2xs font-medium text-condition-attention">
            {!isTask && <Bell aria-hidden className="size-3 shrink-0" />}
            <span className="tabular-nums">
              {waitingLabel(item.date!, now)}
            </span>
          </span>
        )}
        {beyond && (
          <span className="mt-px shrink-0 text-2xs font-medium tabular-nums text-muted-foreground/70">
            {dayCaption(item.date!)}
          </span>
        )}
      </div>

      {density === "comfortable" && isTask && item.createdAt != null && (
        <span className="mt-0.5 block pl-5 text-xs leading-snug text-muted-foreground/45">
          Captured {agoLabel(item.createdAt, now)}
        </span>
      )}
    </div>
  );
}

/**
 * A chip sitting on its day. Click — or Enter/Space while focused — opens the
 * Thread rail in place; a Task chip goes to the Inbox, the only place a Task
 * can be edited. Dragging arms per the sensor note in `plan-canvas.tsx`.
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

  // Hover spells out what the placement means — the bell glyph can only hint
  // that the day is a Follow-up rather than a commitment.
  const lines: string[] = [];
  if (item.kind === "thread" && (item.nextMove || item.date != null)) {
    lines.push(item.title);
    if (item.nextMove) lines.push(`Next Move: ${item.nextMove}`);
    if (item.date != null) {
      lines.push(
        `Follow-up ${format(item.date, "MMM d")} · soft resurfacing date`,
      );
    }
  }
  const hint = lines.length > 0 ? lines.join("\n") : undefined;

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
        // `touch-manipulation`, not `touch-none`: a swipe starting on a chip
        // must still scroll the canvas until the long-press arms the drag.
        "w-full cursor-grab touch-manipulation rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <ChipSurface density={density} item={item} now={now} slotKey={slotKey} />
    </button>
  );
}
