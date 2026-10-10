import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { AttentionBoard } from "./attention-board-model";
import type { BoardScope } from "./dashboard-item";

import { itemId, unscheduledRuns } from "./attention-board-model";
import { DashboardItem } from "./dashboard-item";
import { Count, FileTab } from "./dashboard-list";
import { foldedNoDateSummary, NO_DATE_FILL } from "./dashboard-list-model";

/**
 * What has no date, under one heading, in three runs: Ready to move, Open,
 * Notes. From `lg` it sits beside the list, pinned as the page scrolls.
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
        <div className="flex flex-col gap-5 pt-4">
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
          <div className="flex flex-col gap-4 px-3 pt-1 pb-2">
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
      <h3 className="flex items-baseline gap-2 pb-1 text-[13px] font-semibold text-muted-foreground">
        {run.title}
        <span className="font-normal tabular-nums opacity-70">
          {run.items.length}
        </span>
      </h3>
      <ul className="-mx-3 flex flex-col">
        {run.items.map((item) => (
          <li key={itemId(item)}>
            <DashboardItem item={item} scope={scope} />
          </li>
        ))}
      </ul>
    </section>
  ));
}
