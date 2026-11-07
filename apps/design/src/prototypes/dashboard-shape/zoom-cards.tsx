import type {
  BoardGroup,
  BoardItem,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import type { LineLook } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";

import {
  groupByWhen,
  itemKey,
  unscheduledRuns,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { DashboardLine } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import {
  foldedSummary,
  groupLook,
  LATER_LOOK,
  NO_DATE_LOOK,
} from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { dateToken } from "@vita-os/application/internal/dashboard/components/dashboard-model.ts";
import { FoldedNoDate } from "@vita-os/application/internal/dashboard/components/no-date.tsx";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { BodyProps } from "./board";

/**
 * Cards all the way down: the shipped list, its headings, grading, Later
 * fold and No date as they are, with every item a card instead of a line.
 * A group's cards sit two to a row, so their number reads as a shape before
 * any title is read; the nearer the group, the larger the card's type. Each
 * heading adds its count, small and neutral, as No date's does today.
 */
export function ZoomCards({ board, scope }: BodyProps) {
  const [laterOpen, setLaterOpen] = useState(false);
  const near = groupByWhen([...board.now, ...board.week], scope.currentDate);
  const later = groupByWhen(board.later, scope.currentDate);
  const runs = unscheduledRuns(board);
  const undated = runs.reduce((count, run) => count + run.items.length, 0);

  return (
    <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 lg:pb-16">
        {/* Below `lg`, No date leads the list folded, as it ships. */}
        <FoldedNoDate board={board} scope={scope} />
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
            items={board.later}
            currentDate={scope.currentDate}
            open={laterOpen}
            onOpenChange={setLaterOpen}
          />
        )}
        {laterOpen &&
          later.map((group) => (
            <Group key={group.key} group={group} scope={scope} />
          ))}
      </div>

      <aside
        aria-label="No date"
        className="hidden min-w-0 pt-1 pb-24 lg:block lg:border-l lg:pl-8"
      >
        <h2 className="flex items-baseline gap-2">
          <span className="font-heading text-xl font-semibold tracking-tight">
            No date
          </span>
          <Count count={undated} />
        </h2>
        {undated === 0 ? (
          <p className="pt-2 text-[15px] text-muted-foreground">
            Everything open has a date.
          </p>
        ) : (
          <div className="flex flex-col gap-4 pt-3">
            {runs.map((run) => (
              <section key={run.key} aria-label={run.title}>
                <h3 className="flex items-baseline gap-2 px-1 pb-1.5 text-[13px] font-semibold text-muted-foreground">
                  {run.title}
                  <span className="font-normal tabular-nums opacity-70">
                    {run.items.length}
                  </span>
                </h3>
                <Cards
                  items={run.items}
                  look={NO_DATE_LOOK}
                  scope={scope}
                  columns={1}
                />
              </section>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function Group({
  group,
  scope,
}: {
  group: BoardGroup;
  scope: BodyProps["scope"];
}) {
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
        <Count count={group.items.length} />
        {group.hint && (
          <span className="text-xs text-muted-foreground/70">{group.hint}</span>
        )}
      </h2>
      <Cards
        items={group.items}
        look={look.line}
        scope={scope}
        dateInHeading={group.exact}
        late={group.tone === "late"}
        far={look.distance >= 3}
      />
    </section>
  );
}

/** A group's items as cards, two to a row from `sm`, one in a narrow column. */
function Cards({
  items,
  look,
  scope,
  columns = 2,
  dateInHeading = false,
  late = false,
  far = false,
}: {
  items: BoardItem[];
  look: LineLook;
  scope: BodyProps["scope"];
  columns?: 1 | 2;
  dateInHeading?: boolean;
  late?: boolean;
  far?: boolean;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-1 pt-1",
        far ? "gap-1.5" : "gap-2",
        columns === 2 && "sm:grid-cols-2",
      )}
    >
      {items.map((item) => (
        <li key={itemKey(item)}>
          <div
            className={cn(
              "h-full rounded-xl bg-surface-2 px-1",
              far && "bg-surface-2/60",
              late &&
                "bg-[color-mix(in_oklab,var(--condition-attention)_9%,var(--color-surface-2))] ring-1 ring-condition-attention/30",
            )}
          >
            <DashboardLine
              dateInHeading={dateInHeading}
              item={item}
              look={look}
              scope={scope}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Later folded at the foot as it ships: its count, when the next is due, the first two. */
function LaterFold({
  items,
  currentDate,
  open,
  onOpenChange,
}: {
  items: BoardItem[];
  currentDate: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <section aria-label="Later" className={LATER_LOOK.heading.section}>
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
            <span className="text-xs tabular-nums text-muted-foreground/70">
              {items.length}
            </span>
            <span className="text-xs text-muted-foreground/70">
              next {dateToken(items[0]!.when!, currentDate)}
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
              {foldedSummary(items)}
            </span>
          )}
        </button>
      </h2>
    </section>
  );
}

function Count({ count }: { count: number }) {
  return (
    <span className="text-xs tabular-nums text-muted-foreground/60">
      {count}
    </span>
  );
}
