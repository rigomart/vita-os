import type { ProjectedArea } from "@convex/lib/validators";

import { conditionLabels } from "@convex/lib/condition";
import { format } from "date-fns";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { AreaQuickPanel } from "@/features/areas/components/area-quick-panel";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { AttentionBoard, BoardItem } from "./attention-board-model";

import { itemAreaId } from "./attention-board-model";

/**
 * One row over the board: today's date, the Areas, and the counts.
 *
 * The Areas are drawn as **status, not as filters** — no pill, no enclosing
 * background — because clicking one opens its Quick Panel rather than
 * narrowing the board. Each is its icon in its Condition's colour, its name,
 * and how much of the board belongs to it; healthy Areas go grey so the only
 * colour in the row belongs to the parts of life that are slipping. No reason
 * text: every card below already says what to do.
 */
export function DashboardHeader({
  areas,
  board,
  currentDate,
  items,
  onNewThreadInArea,
}: {
  areas: ProjectedArea[];
  board: AttentionBoard;
  currentDate: number;
  items: BoardItem[];
  onNewThreadInArea: (areaId: string) => void;
}) {
  const date = new Date(currentDate);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border/50 pb-2">
      <h1 className="sr-only">Dashboard</h1>

      <time
        dateTime={date.toISOString()}
        title={format(date, "EEEE, MMMM d, yyyy")}
        className="shrink-0 text-xs text-muted-foreground"
      >
        <span className="font-semibold text-foreground">
          {format(date, "EEE")}
        </span>{" "}
        · {format(date, "MMM d")}
      </time>

      <section
        aria-label="Life Areas by condition"
        className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
      >
        {[...areas].sort(worstFirst).map((area) => {
          const pending = items.filter(
            (item) => itemAreaId(item) === area._id,
          ).length;
          const steady = area.condition === "healthy";

          return (
            <AreaQuickPanel
              key={area._id}
              area={{ ...area, id: area._id }}
              onNewThread={onNewThreadInArea}
              trigger={
                <button
                  type="button"
                  aria-label={`Area panel for ${area.name}`}
                  title={`${area.name} — ${conditionLabels[area.condition]}`}
                  className="group -mx-1 inline-flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              }
            >
              <span
                className={cn(
                  "inline-flex shrink-0",
                  steady
                    ? "text-muted-foreground/70"
                    : conditionTextClassName[area.condition],
                )}
              >
                <AreaIcon icon={area.icon} className="size-4" />
              </span>
              <span
                className={cn(
                  "max-w-36 truncate text-sm underline-offset-4 group-hover:underline",
                  steady
                    ? "text-muted-foreground"
                    : "font-medium text-foreground",
                )}
              >
                {area.name}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                {pending}
              </span>
            </AreaQuickPanel>
          );
        })}
      </section>

      <section
        aria-label="Attention counts"
        className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2"
      >
        <Stat label="Now" urgent value={board.now.length} />
        <Stat label="This week" value={board.week.length} />
        <Stat label="Ready to move" value={board.unscheduled.moves.length} />
        <Stat label="Open" muted value={items.length} />
      </section>
    </div>
  );
}

function Stat({
  label,
  muted,
  urgent,
  value,
}: {
  label: string;
  muted?: boolean;
  urgent?: boolean;
  value: number;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-xl leading-none font-semibold tabular-nums",
          urgent && value > 0 && "text-condition-attention",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-[10px] tracking-wider text-muted-foreground/60 uppercase">
        {label}
      </span>
    </span>
  );
}

/** Worst Condition first, then the Areas' own order. */
function worstFirst(a: ProjectedArea, b: ProjectedArea) {
  const rank = (area: ProjectedArea) =>
    area.condition === "critical" ? 0 : area.condition === "healthy" ? 2 : 1;
  return rank(a) - rank(b) || a.order - b.order;
}
