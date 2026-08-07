import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { TriangleAlert } from "lucide-react";
import { type ReactNode } from "react";

import type { Horizon } from "./horizon-model";

/**
 * One time horizon. Columns are droppable as a whole (there is no ordering
 * model inside a horizon — a Follow-up is a date, not a rank), so the drop
 * target is the column body and the feedback is a column-wide highlight.
 */

export interface BoardColumnProps {
  children: ReactNode;
  /** Rendered as a narrow spine instead of a full column. */
  collapsed?: boolean;
  count: number;
  horizon: Horizon;
}

export function BoardColumn({
  children,
  collapsed,
  count,
  horizon,
}: BoardColumnProps) {
  const isOverdue = horizon.key === "overdue";
  const { isOver, setNodeRef } = useDroppable({
    id: `horizon:${horizon.key}`,
    disabled: isOverdue || collapsed,
  });

  if (collapsed) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 py-3">
        <span className="text-[10px] text-muted-foreground/50 tabular-nums">
          0
        </span>
        <span className="[writing-mode:vertical-rl] text-[11px] tracking-wide text-muted-foreground/45">
          {horizon.label}
        </span>
      </div>
    );
  }

  const over = count > horizon.capacity && !isOverdue;
  const fill = horizon.capacity
    ? Math.min(count / horizon.capacity, 1) * 100
    : 100;

  return (
    <section
      aria-label={horizon.label}
      className={cn(
        "flex min-w-[12.25rem] max-w-[24rem] flex-1 basis-56 flex-col rounded-xl transition-colors",
        isOverdue
          ? "bg-condition-attention/6 ring-1 ring-condition-attention/25"
          : "bg-surface-2/40 ring-1 ring-border/50",
        isOver && "bg-primary/8 ring-2 ring-primary/50",
      )}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-baseline gap-2">
          <h3
            className={cn(
              "font-heading text-[13px] font-semibold tracking-tight",
              isOverdue ? "text-condition-attention" : "text-foreground",
            )}
          >
            {horizon.label}
          </h3>
          <span
            className={cn(
              "ml-auto text-xs font-medium tabular-nums",
              count === 0
                ? "text-muted-foreground/40"
                : isOverdue
                  ? "text-condition-attention"
                  : "text-muted-foreground",
            )}
          >
            {count}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[11px]",
            isOverdue
              ? "text-condition-attention/80"
              : "text-muted-foreground/70",
          )}
        >
          {isOverdue && <TriangleAlert className="size-3" />}
          <span className="truncate">{horizon.hint}</span>
          {over && (
            <span className="ml-auto shrink-0 font-medium text-condition-attention">
              stacking up
            </span>
          )}
        </p>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-border/50">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              isOverdue || over
                ? "bg-condition-attention/70"
                : count === 0
                  ? "bg-transparent"
                  : "bg-primary/45",
            )}
            style={{ width: `${fill}%` }}
          />
        </div>
      </header>

      <div
        ref={setNodeRef}
        className="flex max-h-[30rem] min-h-[7rem] flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-2 pt-1 pb-3"
      >
        {count === 0 ? (
          <ColumnEmpty droppable={!isOverdue} isOver={isOver} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function ColumnEmpty({
  droppable,
  isOver,
}: {
  droppable: boolean;
  isOver: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center rounded-lg border border-dashed px-2 text-center text-[11px] transition-colors",
        isOver
          ? "border-primary/60 bg-primary/5 text-primary"
          : "border-border/60 text-muted-foreground/45",
      )}
    >
      {droppable ? (isOver ? "Drop to schedule" : "Nothing here") : "All clear"}
    </div>
  );
}
