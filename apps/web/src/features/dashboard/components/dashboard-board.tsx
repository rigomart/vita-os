import type { ProjectedArea } from "@convex/lib/validators";
import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { ConnectedThreadAttentionCard } from "@/features/threads/components/thread-attention-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { AttentionBoard, BoardItem } from "./attention-board-model";

import { itemId, unscheduledCount } from "./attention-board-model";
import { DashboardNote } from "./dashboard-note";

/**
 * The board is a board only where the four lanes fit side by side. Below `xl`
 * they stack and the **page** scrolls: giving each stacked lane the viewport's
 * height would leave four short panes, each with its own scrollbar. On a phone
 * the two lanes that carry what is not urgent — Later and the No date margin —
 * start folded, so Now and This week are what the screen opens on.
 */
export function DashboardBoard({
  areas,
  board,
  currentDate,
}: {
  areas: ProjectedArea[];
  board: AttentionBoard;
  currentDate: number;
}) {
  const areaById = new Map(areas.map((area) => [area._id, area]));
  const isMobile = useIsMobile();

  const columns = [
    {
      key: "now",
      title: "Now",
      hint: "Late or due today",
      urgent: true,
      items: board.now,
    },
    {
      key: "week",
      title: "This week",
      hint: "The next six days",
      items: board.week,
    },
    {
      key: "later",
      title: "Later",
      hint: "Dated beyond this week",
      items: board.later,
    },
  ];

  const runs = [
    { key: "moves", title: "Ready to move", items: board.unscheduled.moves },
    { key: "open", title: "Open", items: board.unscheduled.open },
    { key: "notes", title: "Notes", items: board.unscheduled.notes },
  ].filter((run) => run.items.length > 0);

  const renderItem = (item: BoardItem) =>
    item.kind === "note" ? (
      <DashboardNote currentDate={currentDate} note={item.note} />
    ) : (
      <ConnectedThreadAttentionCard
        area={areaById.get(item.thread.areaId)}
        currentDate={currentDate}
        thread={item.thread}
      />
    );

  return (
    <div className="flex flex-col gap-6 xl:min-h-0 xl:flex-1 xl:flex-row xl:gap-8">
      <div className="grid gap-6 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-3 xl:gap-8">
        {columns.map((column) => (
          <BoardLane
            key={column.key}
            collapsible={isMobile && column.key === "later"}
            count={column.items.length}
            hint={column.hint}
            title={column.title}
            tone={column.urgent ? "urgent" : "default"}
          >
            <ul className="-mx-1 flex flex-col gap-1 px-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              {column.items.map((item) => (
                <li key={itemId(item)}>{renderItem(item)}</li>
              ))}
              {column.items.length === 0 && (
                <li className="px-1 py-2 text-xs text-muted-foreground/50">
                  Nothing here.
                </li>
              )}
            </ul>
          </BoardLane>
        ))}
      </div>

      <BoardLane
        className="border-t border-border/50 pt-5 xl:w-64 xl:shrink-0 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-5"
        collapsible={isMobile}
        count={unscheduledCount(board)}
        element="aside"
        title="No date"
        tone="muted"
      >
        <div className="-mx-1 flex flex-col gap-3 px-1 pb-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          {runs.map((run) => (
            <section key={run.key}>
              <h3 className="flex items-baseline gap-1.5 pb-1 text-[11px] leading-snug font-medium text-muted-foreground/70">
                {run.title}
                <span className="tabular-nums text-muted-foreground/45">
                  {run.items.length}
                </span>
              </h3>
              <ul className="flex flex-col gap-1">
                {run.items.map((item) => (
                  <li key={itemId(item)}>{renderItem(item)}</li>
                ))}
              </ul>
            </section>
          ))}

          {runs.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground/50">
              Nothing unscheduled.
            </p>
          )}
        </div>
      </BoardLane>
    </div>
  );
}

const tones = {
  urgent: {
    border: "border-condition-attention/60",
    title: "text-condition-attention",
  },
  default: { border: "border-border/70", title: "text-foreground/70" },
  muted: { border: "border-transparent", title: "text-muted-foreground" },
};

/**
 * One lane of the board: a ruled heading with its count, and its cards under
 * it. A collapsible lane keeps the same heading and makes the whole rule its
 * trigger, so a stacked board reads as a list of lanes rather than as a stack
 * of scroll panes.
 */
function BoardLane({
  children,
  className,
  collapsible = false,
  count,
  element = "section",
  hint,
  title,
  tone,
}: {
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  count: number;
  element?: "aside" | "section";
  hint?: string;
  title: string;
  tone: keyof typeof tones;
}) {
  const [open, setOpen] = useState(false);
  const Element = element;
  const { border, title: titleClass } = tones[tone];

  const label = (
    <>
      <span
        className={cn(
          "text-[11px] font-semibold tracking-widest uppercase",
          titleClass,
        )}
      >
        {title}
      </span>
      <span
        title={hint}
        className="text-[11px] tabular-nums text-muted-foreground/60"
      >
        {count}
      </span>
    </>
  );

  const headingClassName = cn("mb-1.5 flex items-baseline border-b-2", border);

  if (!collapsible) {
    return (
      <Element
        aria-label={title}
        className={cn("flex flex-col xl:min-h-0", className)}
      >
        <h2 className={cn(headingClassName, "gap-2 pb-1.5")}>{label}</h2>
        {children}
      </Element>
    );
  }

  return (
    <Element aria-label={title} className={cn("flex flex-col", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Keep a real heading while making the whole rule the trigger. */}
        <h2 className={headingClassName}>
          <CollapsibleTrigger className="group flex w-full items-baseline gap-2 pb-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
            {label}
            <ChevronRight
              aria-hidden
              className={cn(
                "ml-auto size-4 shrink-0 self-center text-muted-foreground/60 transition-transform group-hover:text-foreground motion-reduce:transition-none",
                open && "rotate-90",
              )}
            />
          </CollapsibleTrigger>
        </h2>

        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    </Element>
  );
}
