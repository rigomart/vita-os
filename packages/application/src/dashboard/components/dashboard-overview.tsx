import type { AreaSummary, Note, Thread } from "@vita-os/contracts";

import type { DashboardFilterParams } from "../../navigation/use-dashboard-filter-params";

import { boardItems, buildAttentionBoard } from "./attention-board-model";
import { DashboardBoard } from "./dashboard-board";
import { filterDashboard } from "./dashboard-filter-model";
import { DashboardFilterRow } from "./dashboard-filter-row";

interface DashboardOverviewProps {
  areas: AreaSummary[];
  /** The `?area=` or `?show=` filter, as the URL carries it. */
  filter?: DashboardFilterParams;
  currentDate: number;
  notes: Note[];
  threads: Thread[];
}

/**
 * The Dashboard answers one question — what needs attention now? — by laying
 * every open Thread and standalone Note on a single axis of time, with
 * everything unscheduled in the margin beside it. Above it, the filter row
 * narrows the board to one part of life, or to Notes, without changing its
 * shape.
 */
export function DashboardOverview({
  areas,
  filter = {},
  currentDate,
  notes,
  threads,
}: DashboardOverviewProps) {
  const filtered = filterDashboard({
    threads,
    notes,
    areas,
    params: filter,
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

      <DashboardFilterRow options={filtered.options} />

      <DashboardBoard
        areas={areas}
        board={board}
        currentDate={currentDate}
        emptyState={
          items.length === 0 ? (
            <section className="flex min-h-48 flex-col items-center justify-center rounded-xl bg-surface-2 px-6 text-center xl:flex-1">
              {narrowed ? (
                <p className="text-sm font-medium">
                  {filtered.filter.kind === "area"
                    ? `Nothing open in ${filtered.filter.area.name}.`
                    : filtered.filter.kind === "notes"
                      ? "No Note is asking for you."
                      : "Every open Thread has an Area."}
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Nothing is asking for you.
                  </p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Every Thread is resolved and every Note is archived.
                  </p>
                </>
              )}
            </section>
          ) : undefined
        }
      />
    </div>
  );
}
