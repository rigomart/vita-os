import type { AreaSummary } from "@vita-os/contracts";
import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type { AttentionBoard, BoardItem } from "./attention-board-model";

import { useIsMobile } from "../../hooks/use-mobile";
import { ConnectedThreadAttentionCard } from "../../threads/components/thread-attention-card";
import { itemId, unscheduledCount } from "./attention-board-model";
import { DashboardNote } from "./dashboard-note";

/**
 * The lanes sit side by side only at `xl`, where the board owns the viewport's
 * height and each lane scrolls. Below it they stack and the page scrolls, and
 * on a phone Later and the No date tray start folded.
 */
export function DashboardBoard({
  areas,
  board,
  currentDate,
}: {
  areas: AreaSummary[];
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

  const renderItem = (item: BoardItem, onTray = false) =>
    item.kind === "note" ? (
      <DashboardNote
        currentDate={currentDate}
        note={item.note}
        onTray={onTray}
      />
    ) : (
      <ConnectedThreadAttentionCard
        area={
          item.thread.areaId === undefined
            ? undefined
            : areaById.get(item.thread.areaId)
        }
        currentDate={currentDate}
        onTray={onTray}
        thread={item.thread}
      />
    );

  return (
    // No date is a peer of the dated lanes and a little wider, because its
    // cards carry as much as theirs do.
    <div className="grid gap-6 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.25fr)] xl:gap-6">
      {columns.map((column) => (
        <BoardLane
          key={column.key}
          collapsible={isMobile && column.key === "later"}
          count={column.items.length}
          hint={column.hint}
          title={column.title}
          tone={column.urgent ? "urgent" : "default"}
        >
          <ul className="-mx-1 flex flex-col gap-1.5 px-1 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            {column.items.map((item) => (
              <li key={itemId(item)}>{renderItem(item)}</li>
            ))}
            {column.items.length === 0 && (
              <li className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground/60">
                Nothing here.
              </li>
            )}
          </ul>
        </BoardLane>
      ))}

      {/* A tray, not a fourth stretch of the calendar: recessed, unruled. */}
      <BoardLane
        className="rounded-3xl bg-muted/50 p-3 pb-1 xl:p-4 xl:pb-2"
        collapsible={isMobile}
        count={unscheduledCount(board)}
        element="aside"
        hint="Not on the calendar"
        title="No date"
        tone="tray"
      >
        <div className="-mx-1 flex flex-col gap-4 px-1 pb-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          {runs.map((run) => (
            <section key={run.key}>
              <h3 className="flex items-baseline gap-1.5 px-3 pb-1.5 text-xs font-medium text-foreground/70">
                {run.title}
                <span className="tabular-nums text-muted-foreground/60">
                  {run.items.length}
                </span>
              </h3>
              <ul className="flex flex-col gap-1.5">
                {run.items.map((item) => (
                  <li key={itemId(item)}>{renderItem(item, true)}</li>
                ))}
              </ul>
            </section>
          ))}

          {runs.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground/60">
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
    border: "border-condition-attention/50",
    title: "text-condition-attention",
  },
  default: { border: "border-border/70", title: "text-foreground/80" },
  tray: { border: "border-transparent", title: "text-foreground/80" },
};

/**
 * One lane: a ruled heading — title, count, and what the lane holds — and its
 * cards under it.
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
      <span className={cn("text-sm font-medium", titleClass)}>{title}</span>
      {/* Colour only when urgent and non-empty: the one number worth alarming. */}
      <span
        className={cn(
          "text-sm tabular-nums",
          tone === "urgent" && count > 0
            ? "font-medium text-condition-attention"
            : "text-muted-foreground/70",
        )}
      >
        {count}
      </span>
      {hint && (
        <span className="ml-auto truncate pl-2 text-[11px] text-muted-foreground/60">
          {hint}
        </span>
      )}
    </>
  );

  // Inset like a card's text, so a lane's title lines up with its cards.
  const headingClassName = cn("mb-2 flex items-baseline border-b px-3", border);

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
            {!hint && <span className="ml-auto" />}
            <ChevronRight
              aria-hidden
              className={cn(
                "size-4 shrink-0 self-center text-muted-foreground/60 transition-transform group-hover:text-foreground motion-reduce:transition-none",
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
