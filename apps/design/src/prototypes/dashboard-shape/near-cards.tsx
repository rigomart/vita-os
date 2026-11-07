import {
  groupByWhen,
  itemKey,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { DashboardLine } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import {
  foldedSummary,
  groupLook,
  LATER_LOOK,
} from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { NoDate } from "@vita-os/application/internal/dashboard/components/no-date.tsx";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { BodyProps } from "./board";

import { BandCount } from "./board";
import { ItemCard } from "./tile";

/**
 * The list as it ships, except what is asking: Late and Today are piles of
 * cards under a large count, three to a row, so their number is seen before
 * a word is read. The days after are the graded lines they are today, and
 * No date stays beside.
 */
export function NearCards({ bands, board, scope }: BodyProps) {
  const [laterOpen, setLaterOpen] = useState(false);
  const week = groupByWhen(board.week, scope.currentDate);
  const later = groupByWhen(board.later, scope.currentDate);

  return (
    <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-[auto_minmax(0,1fr)]">
          {bands
            .filter((band) => band.key === "late" || band.key === "today")
            .map((band) => (
              <section
                key={band.key}
                aria-label={band.label}
                className="contents"
              >
                <h2 className="flex items-baseline gap-2 border-t border-border/80 pt-4 md:flex-col md:gap-0">
                  <BandCount band={band} className="text-5xl leading-none" />
                  <span
                    className={cn(
                      "font-heading text-lg font-semibold",
                      band.key === "late" &&
                        band.items.length > 0 &&
                        "text-condition-attention",
                    )}
                  >
                    {band.label}
                  </span>
                </h2>
                <div className="border-t border-border/80 pt-4 pb-6">
                  {band.items.length === 0 ? (
                    <p className="pt-3 text-sm text-muted-foreground">
                      {band.key === "late" ? "Nothing late." : "Nothing today."}
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {band.items.map((item) => (
                        <li key={itemKey(item)}>
                          <ItemCard
                            item={item}
                            scope={scope}
                            distance={0}
                            late={band.key === "late"}
                            className="h-full"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
        </div>

        {week
          .filter((group) => group.tone !== "late" && group.tone !== "today")
          .map((group) => {
            const look = groupLook(group);
            return (
              <section key={group.key} className={look.heading.section}>
                <h2
                  className={cn(
                    "flex items-baseline gap-2.5 border-t px-1",
                    look.heading.rule,
                  )}
                >
                  <span className={cn("font-heading", look.heading.label)}>
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
                    <li key={itemKey(item)}>
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

        {board.later.length > 0 && (
          <section className="border-t border-border/50 pt-2.5">
            <button
              type="button"
              className="flex w-full items-baseline gap-2 px-1 text-left"
              onClick={() => setLaterOpen((open) => !open)}
            >
              <span className="text-sm font-medium">Later</span>
              <span className="text-xs text-muted-foreground">
                {board.later.length}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {foldedSummary(board.later)}
              </span>
              <ChevronDown
                className={cn(
                  "ml-auto size-4 text-muted-foreground",
                  laterOpen && "rotate-180",
                )}
              />
            </button>
            {laterOpen && (
              <ul className="-mx-1.5 pt-1">
                {later
                  .flatMap((group) => group.items)
                  .map((item) => (
                    <li key={itemKey(item)}>
                      <DashboardLine
                        dateInHeading={false}
                        item={item}
                        look={LATER_LOOK.line}
                        scope={scope}
                      />
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}
      </div>
      <aside
        aria-label="No date"
        className="hidden min-w-0 border-l pl-8 lg:block"
      >
        <NoDate board={board} scope={scope} />
      </aside>
    </div>
  );
}
