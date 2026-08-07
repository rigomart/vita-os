import { useDraggable } from "@dnd-kit/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { cn } from "@vita-os/ui/lib/utils";
import { CornerDownRight } from "lucide-react";
import { useState } from "react";

import type { MockArea, MockThread } from "../mock-data";
import type { ColumnKey } from "./model";
import type { PlanAction } from "./plan-state";

import { ChipEditor } from "./chip-editor";
import { followUpLabel } from "./model";

export type Density = "comfortable" | "compact";

export interface ChipDragData {
  areaId: string;
  column: ColumnKey;
  threadId: string;
}

/** Left rail colour, mirroring the attention-list rail tones. */
const railTone: Partial<Record<ColumnKey, string>> = {
  overdue: "bg-condition-attention",
  today: "bg-brand-accent-foreground",
};

const surfaceTone: Partial<Record<ColumnKey, string>> = {
  overdue:
    "border-condition-attention/30 bg-condition-attention/8 hover:border-condition-attention/50",
  today: "border-border bg-surface-2",
};

/**
 * Presentation only — shared by the in-grid chip and the drag overlay so the
 * dragged item is pixel-identical to the one it left behind.
 */
export function ChipSurface({
  className,
  column,
  density,
  lifted,
  now,
  thread,
}: {
  className?: string;
  column: ColumnKey;
  density: Density;
  lifted?: boolean;
  now: number;
  thread: MockThread;
}) {
  const stamp = followUpLabel(thread.followUp, now);
  const showStamp = column !== "none" && column !== "today";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border/70 bg-surface-2 py-1.5 pr-2 pl-3 text-left transition-colors",
        surfaceTone[column] ?? "hover:border-border hover:bg-surface-3/50",
        lifted && "border-border shadow-lg ring-1 ring-foreground/5",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-[3px] rounded-r-full",
          railTone[column] ?? "bg-border",
        )}
      />
      <div className="flex items-start gap-1.5">
        <span
          className={cn(
            "min-w-0 flex-1 text-xs leading-snug font-medium",
            density === "compact" ? "truncate" : "line-clamp-2",
          )}
        >
          {thread.title}
        </span>
        {showStamp && (
          <span
            className={cn(
              "mt-px shrink-0 text-[10px] tabular-nums",
              column === "overdue"
                ? "text-condition-attention"
                : "text-muted-foreground/60",
            )}
          >
            {stamp}
          </span>
        )}
      </div>

      {density === "comfortable" &&
        (thread.nextMove ? (
          <span className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
            <CornerDownRight className="mt-[3px] size-2.5 shrink-0 opacity-60" />
            <span className="truncate">{thread.nextMove}</span>
          </span>
        ) : (
          <span className="mt-1 block text-[11px] leading-snug text-muted-foreground/45">
            No Next Move
          </span>
        ))}
    </div>
  );
}

export function ThreadChip({
  area,
  column,
  density,
  dispatch,
  now,
  thread,
}: {
  area: MockArea | undefined;
  column: ColumnKey;
  density: Density;
  dispatch: (action: PlanAction) => void;
  now: number;
  thread: MockThread;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
    useDraggable({
      id: thread.id,
      data: { areaId: thread.areaId, column, threadId: thread.id },
    });

  const trigger = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={`${thread.title} — ${followUpLabel(thread.followUp, now)}`}
      className="w-full cursor-grab touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing"
      {...listeners}
      {...attributes}
    />
  );

  const chip = (
    <ChipSurface column={column} density={density} now={now} thread={thread} />
  );

  return (
    <div
      ref={setNodeRef}
      className={cn("w-full", isDragging && "opacity-35")}
      data-chip={thread.id}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={trigger}>
          {density === "compact" && thread.nextMove ? (
            <Tooltip>
              <TooltipTrigger render={<span className="block w-full" />}>
                {chip}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[16rem]">
                {thread.nextMove}
              </TooltipContent>
            </Tooltip>
          ) : (
            chip
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[19.5rem] gap-0 p-0"
          side="bottom"
        >
          <ChipEditor
            area={area}
            dispatch={dispatch}
            now={now}
            onClose={() => setOpen(false)}
            thread={thread}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
