import type {
  ProjectedArea,
  ProjectedNote,
  ProjectedThread,
} from "@convex/lib/validators";

import { Button } from "@vita-os/ui/components/button";

import { boardItems, buildAttentionBoard } from "./attention-board-model";
import { DashboardBoard } from "./dashboard-board";
import { DashboardHeader } from "./dashboard-header";

interface DashboardOverviewProps {
  areas: ProjectedArea[];
  currentDate: number;
  notes: ProjectedNote[];
  onCreateArea: () => void;
  /** Capture scoped to an Area, raised from an Area's Quick Panel. */
  onNewThreadInArea: (areaId: string) => void;
  threads: ProjectedThread[];
}

/**
 * The Dashboard answers one question — what needs attention now? — by laying
 * every open Thread and standalone Note on a single axis of time, with the
 * Areas' Condition over it and everything unscheduled in the margin beside it.
 */
export function DashboardOverview({
  areas,
  currentDate,
  notes,
  onCreateArea,
  onNewThreadInArea,
  threads,
}: DashboardOverviewProps) {
  if (areas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="sr-only">Dashboard</h1>
        <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
          <h2 className="font-heading text-lg font-semibold">
            Start with a Life Area
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Add the first part of life you want Vita to help you keep in view.
          </p>
          <Button className="mt-4" onClick={onCreateArea}>
            Create Life Area
          </Button>
        </section>
      </div>
    );
  }

  const board = buildAttentionBoard(threads, notes, currentDate);
  const items = boardItems(board);

  return (
    <div className="flex flex-col gap-3 xl:h-[calc(100svh-10rem)] xl:min-h-136">
      <DashboardHeader
        areas={areas}
        board={board}
        currentDate={currentDate}
        items={items}
        onNewThreadInArea={onNewThreadInArea}
      />

      {items.length === 0 ? (
        <section className="flex min-h-48 flex-col items-center justify-center rounded-xl bg-surface-2 px-6 text-center xl:flex-1">
          <p className="text-sm font-medium">Nothing is asking for you.</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Every Thread is resolved and every Note is done.
          </p>
        </section>
      ) : (
        <DashboardBoard areas={areas} board={board} currentDate={currentDate} />
      )}
    </div>
  );
}
