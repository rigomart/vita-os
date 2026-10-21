import { cn } from "@vita-os/ui/lib/utils";

import type { AttentionBoard } from "./attention-board-model";
import type { BoardScope } from "./dashboard-line";

import { groupByWhen, itemKey } from "./attention-board-model";
import { DashboardLine } from "./dashboard-line";
import { CURSOR_SCROLL_MARGIN, groupLook } from "./dashboard-list-model";

/**
 * Every dated item in one list, what is asking first: Late, Today, then each
 * day of the week, then weeks and months. A Thread stands once per dated
 * Task, under the day it is about. Each group is a ruled heading over its
 * items' lines, the date's number first when it names one day. The nearer a
 * group, the larger and darker it reads; the far ones recede.
 */
export function DashboardList({
  board,
  scope,
}: {
  board: AttentionBoard;
  scope: BoardScope;
}) {
  const groups = groupByWhen(
    [...board.now, ...board.week, ...board.later],
    scope.currentDate,
  );

  if (groups.length === 0) {
    return (
      <p className="pt-2 text-[15px] text-muted-foreground">
        Nothing is on the calendar.
      </p>
    );
  }

  return (
    <div className="@container flex flex-col">
      {groups.map((group) => {
        const look = groupLook(group);
        const day = group.exact ? group.items[0]?.when : undefined;
        return (
          <section
            key={group.key}
            aria-label={group.label}
            className={look.heading.section}
          >
            <h2
              className={cn(
                "flex items-baseline gap-2.5 border-t px-1",
                look.heading.rule,
              )}
            >
              {day !== undefined && (
                <span
                  aria-hidden
                  className={cn(
                    "font-heading tabular-nums",
                    look.heading.numeral,
                  )}
                >
                  {new Date(day).getDate()}
                </span>
              )}
              <span
                className={cn(
                  "font-heading tracking-tight",
                  look.heading.label,
                )}
              >
                {group.label}
              </span>
              {group.hint && (
                <span className="text-xs text-muted-foreground/70">
                  {group.hint}
                </span>
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
      })}
    </div>
  );
}
