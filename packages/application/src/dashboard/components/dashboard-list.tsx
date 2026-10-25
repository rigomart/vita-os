import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { AttentionBoard, BoardGroup } from "./attention-board-model";
import type { BoardScope } from "./dashboard-line";

import { groupByWhen, itemKey } from "./attention-board-model";
import { DashboardLine } from "./dashboard-line";
import {
  CURSOR_SCROLL_MARGIN,
  foldedSummary,
  groupLook,
  LATER_LOOK,
} from "./dashboard-list-model";
import { dateToken } from "./dashboard-model";

/**
 * Every dated item in one list, what is asking first: Late, Today, then each
 * day of the week. A Thread stands once per dated Task, under the day it is
 * about. Each group is a ruled heading over its items' lines, the date's
 * number first when it names one day. The nearer a group, the larger and
 * darker it reads.
 *
 * From a week out on, the weeks and months fold into one Later line at the
 * foot, naming how many it holds, when the next comes due and the first two.
 * Opening it shows them as groups.
 */
export function DashboardList({
  board,
  laterOpen,
  onLaterOpenChange,
  scope,
}: {
  board: AttentionBoard;
  laterOpen: boolean;
  onLaterOpenChange: (open: boolean) => void;
  scope: BoardScope;
}) {
  const near = groupByWhen([...board.now, ...board.week], scope.currentDate);
  const later = groupByWhen(board.later, scope.currentDate);

  if (near.length === 0 && later.length === 0) {
    return (
      <p className="pt-2 text-sm text-muted-foreground">
        Nothing is on the calendar.
      </p>
    );
  }

  return (
    <div className="@container flex flex-col">
      {near.length === 0 && (
        <p className="px-1 pt-2 pb-3 text-sm text-muted-foreground">
          Nothing this week.
        </p>
      )}
      {near.map((group) => (
        <Group key={group.key} group={group} scope={scope} />
      ))}
      {board.later.length > 0 && (
        <LaterFold
          board={board}
          currentDate={scope.currentDate}
          open={laterOpen}
          onOpenChange={onLaterOpenChange}
        />
      )}
      {laterOpen &&
        later.map((group) => (
          <Group key={group.key} group={group} scope={scope} />
        ))}
    </div>
  );
}

function Group({ group, scope }: { group: BoardGroup; scope: BoardScope }) {
  const look = groupLook(group);
  const day = group.exact ? group.items[0]?.when : undefined;
  return (
    <section aria-label={group.label} className={look.heading.section}>
      <h2
        className={cn(
          "flex items-baseline gap-2.5 border-t px-1",
          look.heading.rule,
        )}
      >
        {day !== undefined && (
          <span
            aria-hidden
            className={cn("font-heading tabular-nums", look.heading.numeral)}
          >
            {new Date(day).getDate()}
          </span>
        )}
        <span className={cn("font-heading tracking-tight", look.heading.label)}>
          {group.label}
        </span>
        {group.hint && (
          <span className="text-xs text-muted-foreground/70">{group.hint}</span>
        )}
      </h2>
      <ul className="-mx-1.5">
        {group.items.map((item) => (
          <li
            key={itemKey(item)}
            data-cursor-item={itemKey(item)}
            className={CURSOR_SCROLL_MARGIN}
          >
            <DashboardLine
              dateInHeading={group.exact}
              item={item}
              look={look.line}
              scope={scope}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LaterFold({
  board,
  currentDate,
  open,
  onOpenChange,
}: {
  board: AttentionBoard;
  currentDate: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const count = board.later.length;
  const pops = usePopsOnGrowth(count);
  const next = board.later[0]!.when!;
  return (
    <section
      aria-label="Later"
      data-cursor-item="later"
      className={cn(LATER_LOOK.heading.section, CURSOR_SCROLL_MARGIN)}
    >
      <h2 className={cn("border-t", LATER_LOOK.heading.rule, "pt-0 pb-0")}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="group/fold flex w-full flex-col gap-0.5 rounded-lg px-1 pt-2.5 pb-1.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="flex w-full items-baseline gap-2.5">
            <span
              className={cn(
                "font-heading tracking-tight",
                LATER_LOOK.heading.label,
              )}
            >
              Later
            </span>
            <span
              key={pops}
              className={cn(
                "text-xs tabular-nums text-muted-foreground/70",
                pops > 0 &&
                  "animate-in duration-500 zoom-in-150 motion-reduce:animate-none",
              )}
            >
              {count}
            </span>
            <span className="text-xs text-muted-foreground/70">
              next {dateToken(next, currentDate)}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "ml-auto size-4 shrink-0 self-center text-muted-foreground/60 transition-transform group-hover/fold:text-foreground motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </span>
          {!open && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {foldedSummary(board.later)}
            </span>
          )}
        </button>
      </h2>
    </section>
  );
}

/** How many times `count` has grown since mount: a key that replays a pop. */
function usePopsOnGrowth(count: number) {
  const [seen, setSeen] = useState(count);
  const [pops, setPops] = useState(0);
  if (count !== seen) {
    setSeen(count);
    if (count > seen) setPops(pops + 1);
  }
  return pops;
}
