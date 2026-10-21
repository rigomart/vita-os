import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";

import type { AttentionBoard } from "./attention-board-model";
import type { BoardScope } from "./dashboard-line";

import { itemKey, unscheduledRuns } from "./attention-board-model";
import { DashboardLine } from "./dashboard-line";
import {
  CURSOR_SCROLL_MARGIN,
  foldedNoDateSummary,
  NO_DATE_FILL,
  NO_DATE_LOOK,
} from "./dashboard-list-model";

/**
 * What has no date, under one heading, in three runs of lines like the
 * list's: Ready to move, Open, Notes. From `lg` it sits beside the list,
 * pinned as the page scrolls.
 */
export function NoDate({
  board,
  scope,
}: {
  board: AttentionBoard;
  scope: BoardScope;
}) {
  const runs = unscheduledRuns(board);
  const total = runs.reduce((count, run) => count + run.items.length, 0);
  return (
    <>
      <h2 className="flex items-baseline gap-2">
        <span className="font-heading text-xl font-semibold tracking-tight">
          No date
        </span>
        <Count count={total} />
      </h2>
      {total === 0 ? (
        <p className="pt-2 text-[15px] text-muted-foreground">
          Everything open has a date.
        </p>
      ) : (
        <div className="flex flex-col gap-4 pt-3">
          <Runs board={board} scope={scope} />
        </div>
      )}
    </>
  );
}

/**
 * Below `lg`, No date leads the list as a tab folded to one line naming what
 * it holds, so it is seen on first view without pushing the days down. It
 * opens in place. With nothing undated it is not there at all.
 */
export function FoldedNoDate({
  board,
  scope,
}: {
  board: AttentionBoard;
  scope: BoardScope;
}) {
  const [open, setOpen] = useState(false);
  const items = unscheduledRuns(board).flatMap((run) => run.items);
  if (items.length === 0) return null;

  return (
    <div className="pt-1 pb-3 lg:hidden">
      <FileTab
        label="No date"
        fill={NO_DATE_FILL}
        heading={
          <>
            <span className="font-heading text-base font-semibold tracking-tight">
              No date
            </span>
            <Count count={items.length} />
          </>
        }
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="min-w-0 flex-1 truncate">
            {open ? "Hide" : foldedNoDateSummary(items)}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div className="flex flex-col gap-3 px-3 pt-1 pb-2">
            <Runs board={board} scope={scope} />
          </div>
        )}
      </FileTab>
    </div>
  );
}

function Runs({ board, scope }: { board: AttentionBoard; scope: BoardScope }) {
  return unscheduledRuns(board).map((run) => (
    <section key={run.key} aria-label={run.title}>
      <h3 className="flex items-baseline gap-2 px-1 pb-0.5 text-[13px] font-semibold text-muted-foreground">
        {run.title}
        <span className="font-normal tabular-nums opacity-70">
          {run.items.length}
        </span>
      </h3>
      <ul className="-mx-1.5">
        {run.items.map((item) => (
          <li
            key={itemKey(item)}
            data-cursor-item={itemKey(item)}
            className={CURSOR_SCROLL_MARGIN}
          >
            <DashboardLine
              dateInHeading={false}
              item={item}
              look={NO_DATE_LOOK}
              scope={scope}
            />
          </li>
        ))}
      </ul>
    </section>
  ));
}

/**
 * Folded No date as one shape, like a file tab on its folder: the heading on
 * a tab, the summary on the fill below, and the corner where they meet turned
 * inward.
 */
function FileTab({
  children,
  fill,
  heading,
  label,
}: {
  children: ReactNode;
  fill: string;
  heading: ReactNode;
  label: string;
}) {
  return (
    <section aria-label={label}>
      <div className="flex">
        <div className={cn("relative rounded-t-xl", fill)}>
          <h2 className="flex items-baseline gap-2.5 px-4 pt-2 pb-1">
            {heading}
          </h2>
          <span
            aria-hidden
            className={cn(
              "absolute bottom-0 left-full size-3 [mask-image:radial-gradient(circle_at_100%_0,transparent_11.5px,black_12px)]",
              fill,
            )}
          />
        </div>
      </div>
      <div className={cn("rounded-2xl rounded-tl-none p-1.5", fill)}>
        {children}
      </div>
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
