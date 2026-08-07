import { cn } from "@vita-os/ui/lib/utils";
import { ArrowRight, GripVertical } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea, MockThread } from "../mock-data";
import type { Placement } from "./horizon-model";

import { latenessLabel, shortDate } from "./horizon-model";

/**
 * The board's atom. Title + Area + Next Move is the whole card — a planner
 * cares what the next useful action is, so the Next Move gets equal weight to
 * the title, and its absence is called out rather than hidden.
 */

export interface ThreadCardProps {
  area: MockArea | undefined;
  /** Ghost placeholder left behind while the real card rides the overlay. */
  isDragging?: boolean;
  /** Briefly true right after a drop, to confirm where the card landed. */
  landed?: boolean;
  now: number;
  /** Lifted copy rendered inside the DragOverlay. */
  overlay?: boolean;
  placement: Placement;
  /** Compact horizontal variant used inside the No-date tray. */
  quiet?: boolean;
  /** Playing its exit animation before leaving the board. */
  resolving?: boolean;
  selected?: boolean;
  thread: MockThread;
}

const accentByPlacement: Partial<Record<Placement, string>> = {
  overdue: "before:bg-condition-attention",
  today: "before:bg-primary",
};

export function ThreadCard({
  area,
  isDragging,
  landed,
  now,
  overlay,
  placement,
  quiet,
  resolving,
  selected,
  thread,
}: ThreadCardProps) {
  const accent = accentByPlacement[placement];

  return (
    <div
      className={cn(
        "group/card relative w-full overflow-hidden rounded-xl bg-surface-2 text-left ring-1 ring-border/70",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        accent ?? "before:bg-transparent",
        quiet ? "px-3 py-2" : "px-3 py-2.5",
        "transition-[box-shadow,transform,opacity,background-color] duration-200",
        !overlay && "hover:bg-surface-3 hover:ring-border",
        selected && "ring-2 ring-primary/70",
        landed && "ring-2 ring-primary/60",
        isDragging && "opacity-35",
        overlay && "rotate-[1.5deg] scale-[1.02] shadow-xl ring-primary/40",
        resolving && "scale-[0.96] opacity-0",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {area && (
              <>
                <AreaIcon icon={area.icon} className="size-3 shrink-0" />
                <span className="truncate">{area.name}</span>
              </>
            )}
            <span className="ml-auto shrink-0 pl-1">
              <DateMark
                now={now}
                placement={placement}
                quiet={quiet}
                thread={thread}
              />
            </span>
          </div>

          <p
            className={cn(
              "mt-1 line-clamp-2 text-[13px] leading-snug font-medium text-foreground",
              quiet && "line-clamp-1",
            )}
          >
            {thread.title}
          </p>

          {thread.nextMove ? (
            <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
              <ArrowRight className="mt-[2px] size-3 shrink-0 text-muted-foreground/60" />
              <span className={cn("line-clamp-2", quiet && "line-clamp-1")}>
                {thread.nextMove}
              </span>
            </p>
          ) : (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/45 italic">
              <span className="size-3 shrink-0 rounded-full border border-dashed border-current" />
              No next move
            </p>
          )}
        </div>

        {!quiet && (
          <GripVertical
            aria-hidden
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover/card:text-muted-foreground/40"
          />
        )}
      </div>
    </div>
  );
}

/**
 * The date-rail idiom, compressed to a card's top line.
 *
 * Deliberately silent in Today / Tomorrow / No date, where the column header
 * already says the date — the mark only earns its space when the column covers
 * a *range* (or when lateness is the point).
 */
function DateMark({
  now,
  placement,
  quiet,
  thread,
}: {
  now: number;
  placement: Placement;
  quiet?: boolean;
  thread: MockThread;
}) {
  if (thread.followUp == null || quiet) return null;

  if (placement === "overdue") {
    return (
      <span className="rounded-full bg-condition-attention/12 px-1.5 py-px text-[10px] font-medium text-condition-attention tabular-nums">
        {latenessLabel(thread.followUp, now)}
      </span>
    );
  }

  if (placement === "today" || placement === "tomorrow") return null;

  return (
    <time
      dateTime={new Date(thread.followUp).toISOString()}
      className="text-[10px] text-muted-foreground/70 tabular-nums"
    >
      {shortDate(thread.followUp)}
    </time>
  );
}
