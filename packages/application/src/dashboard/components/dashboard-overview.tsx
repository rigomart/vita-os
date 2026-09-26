import type { AreaSummary, Note, Thread } from "@vita-os/contracts";

import { boardItems, buildAttentionBoard } from "./attention-board-model";
import { DashboardBoard } from "./dashboard-board";
import { filterDashboard } from "./dashboard-filter-model";
import { DashboardFilterRow } from "./dashboard-filter-row";

interface DashboardOverviewProps {
  areas: AreaSummary[];
  /** The `?area=` filter, as the URL carries it. */
  areaFilter?: string | undefined;
  currentDate: number;
  notes: Note[];
  threads: Thread[];
}

/**
 * The Dashboard answers one question — what needs attention now? — by laying
 * every open Thread and standalone Note on a single axis of time, with
 * everything unscheduled in the margin beside it. Above it, the Area filter
 * narrows the board to one part of life without changing its shape.
 */
export function DashboardOverview({
  areas,
  areaFilter,
  currentDate,
  notes,
  threads,
}: DashboardOverviewProps) {
  const filtered = filterDashboard({
    threads,
    notes,
    areas,
    param: areaFilter,
  });
  const board = buildAttentionBoard(
    filtered.threads,
    filtered.notes,
    currentDate,
  );
  const items = boardItems(board);
  const narrowed = filtered.filter.kind !== "all";

  return (
    // 12rem: the chrome's clearance is what the board sits inside now.
    <div className="flex flex-col gap-3 xl:h-[calc(100svh-12rem)] xl:min-h-136">
      <h1 className="sr-only">Dashboard</h1>

      {areas.length > 0 && <DashboardFilterRow options={filtered.options} />}

      {items.length === 0 ? (
        <section className="flex min-h-48 flex-col items-center justify-center rounded-xl bg-surface-2 px-6 text-center xl:flex-1">
          {narrowed ? (
            <p className="text-sm font-medium">
              {filtered.filter.kind === "area"
                ? `Nothing open in ${filtered.filter.area.name}.`
                : "Every open Thread has an Area."}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Nothing is asking for you.</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Every Thread is resolved and every Note is done.
              </p>
            </>
          )}
        </section>
      ) : (
        <DashboardBoard areas={areas} board={board} currentDate={currentDate} />
      )}
    </div>
  );
}
