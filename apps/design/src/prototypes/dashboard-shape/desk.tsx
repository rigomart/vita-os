import type { BoardItem } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";

import {
  groupByWhen,
  itemKey,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { DashboardLine } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import {
  foldedSummary,
  lookAt,
} from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { BodyProps } from "./board";

import { Count, SpanLabel } from "./board";
import { ItemCard } from "./tile";

/**
 * The page split in two by what it asks of you. The desk, most of the
 * page, holds only what is asking, Late and Today, as large cards two to
 * a row under their counts. Everything else, the week, Later and No date,
 * is one quiet margin of counted, foldable runs of small lines. A day with
 * nothing asking shows an empty desk and says when the next thing comes.
 */
export function Desk({ bands, board, scope }: BodyProps) {
  const late = bands.find((band) => band.key === "late")!;
  const today = bands.find((band) => band.key === "today")!;
  const none = bands.find((band) => band.key === "none")!;
  const week = groupByWhen(board.week, scope.currentDate);
  const asking = late.items.length + today.items.length;

  return (
    <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 rounded-3xl bg-surface-1 p-5 ring-1 ring-border/50">
        {asking === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <p className="font-heading text-xl font-semibold">
              Nothing is asking today.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {board.week.length > 0
                ? `${board.week.length} this week, the next ${week[0]!.label.toLowerCase()}.`
                : "Nothing this week either."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {[late, today].map((band) =>
              band.items.length === 0 ? (
                <p
                  key={band.key}
                  className="flex items-baseline gap-2 text-muted-foreground"
                >
                  <Count count={0} className="text-2xl" />
                  <span className="text-base">
                    {band.key === "late" ? "Nothing late" : "Nothing today"}
                  </span>
                </p>
              ) : (
                <section key={band.key} aria-label={band.label}>
                  <h2 className="flex items-baseline gap-2.5 pb-3">
                    <Count count={band.items.length} className="text-5xl" />
                    <SpanLabel
                      label={band.label}
                      late={band.key === "late"}
                      className="text-xl"
                    />
                  </h2>
                  <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {band.items.map((item) => (
                      <li key={itemKey(item)}>
                        <ItemCard
                          item={item}
                          scope={scope}
                          distance={0}
                          late={band.key === "late"}
                          className="h-full px-3 py-2"
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            )}
          </div>
        )}
      </div>

      <aside
        aria-label="Ahead"
        className="flex min-w-0 flex-col gap-1 pt-6 lg:pt-1"
      >
        <Run label="This week" items={board.week} scope={scope} open>
          {week.map((group) => (
            <div key={group.key} className="pt-1.5">
              <p className="px-1 text-xs font-medium text-muted-foreground">
                {group.label}
                {group.hint && (
                  <span className="text-muted-foreground/60">
                    {" "}
                    · {group.hint}
                  </span>
                )}
              </p>
              <Lines items={group.items} scope={scope} dateInHeading />
            </div>
          ))}
        </Run>
        <Run label="Later" items={board.later} scope={scope} />
        <Run label="No date" items={none.items} scope={scope} />
      </aside>
    </div>
  );
}

function Run({
  label,
  items,
  scope,
  open: startOpen = false,
  children,
}: {
  label: string;
  items: BoardItem[];
  scope: BodyProps["scope"];
  open?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <section aria-label={label} className="border-b border-border/50 pb-2">
      <button
        type="button"
        className="flex w-full items-baseline gap-2 px-1 py-1.5 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <Count count={items.length} className="text-xl text-foreground/80" />
        <span className="shrink-0 text-sm font-semibold whitespace-nowrap text-foreground/80">
          {label}
        </span>
        {!open && items.length > 0 && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {foldedSummary(items)}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (children ?? <Lines items={items} scope={scope} />)}
    </section>
  );
}

function Lines({
  items,
  scope,
  dateInHeading = false,
}: {
  items: BoardItem[];
  scope: BodyProps["scope"];
  dateInHeading?: boolean;
}) {
  return (
    <ul className="-mx-1.5">
      {items.map((item) => (
        <li key={itemKey(item)}>
          <DashboardLine
            dateInHeading={dateInHeading}
            item={item}
            look={lookAt(3).line}
            scope={scope}
          />
        </li>
      ))}
    </ul>
  );
}
