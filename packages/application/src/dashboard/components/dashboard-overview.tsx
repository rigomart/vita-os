import type { AreaSummary, Note, Thread } from "@vita-os/contracts";

import { useState } from "react";

import type { DashboardFilterParams } from "../../navigation/use-dashboard-filter-params";
import type { BoardScope } from "./dashboard-item";

import { StandaloneNoteDialog } from "../../notes/note-view/standalone-note-dialog";
import { boardItems, buildAttentionBoard } from "./attention-board-model";
import { DashboardFilter } from "./dashboard-filter";
import { filterDashboard } from "./dashboard-filter-model";
import { DashboardList } from "./dashboard-list";
import { FoldedNoDate, NoDate } from "./no-date";

interface DashboardOverviewProps {
  areas: AreaSummary[];
  /** The `?area=` or `?show=` filter, as the URL carries it. */
  filter?: DashboardFilterParams;
  currentDate: number;
  notes: Note[];
  threads: Thread[];
}

/**
 * The Dashboard answers one question — what needs attention now? — as one
 * list read from what is asking now out to what is far off, with what has no
 * date beside it. The page scrolls; the filter sticks to the top of the list
 * and, from `lg`, No date to the side. Below `lg` No date leads the list,
 * folded to one line.
 */
export function DashboardOverview({
  areas,
  filter = {},
  currentDate,
  notes,
  threads,
}: DashboardOverviewProps) {
  // Held here, not on a card, so the Note view outlives its card leaving.
  const [openNote, setOpenNote] = useState<Note | null>(null);
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
  const empty = boardItems(board).length === 0;
  const scope: BoardScope = {
    areaById: new Map(areas.map((area) => [area._id, area])),
    currentDate,
    onOpenNote: setOpenNote,
  };

  return (
    <div className="mx-auto grid max-w-[76rem] gap-x-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 lg:pb-16">
        <h1 className="sr-only">Dashboard</h1>
        <div className="sticky top-0 z-20 -mx-4 bg-surface-1/90 px-4 pt-5 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-3 lg:px-3">
          <DashboardFilter options={filtered.options} />
        </div>

        {empty ? (
          <section className="mt-2 flex min-h-48 flex-col items-center justify-center rounded-2xl bg-surface-2 px-6 text-center">
            {filtered.filter.kind === "all" ? (
              <>
                <p className="text-sm font-medium">
                  Nothing is asking for you.
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Every Thread is resolved and every Note is archived.
                </p>
              </>
            ) : (
              <p className="text-sm font-medium">
                {filtered.filter.kind === "area"
                  ? `Nothing open in ${filtered.filter.area.name}.`
                  : filtered.filter.kind === "notes"
                    ? "No Note is asking for you."
                    : "Every open Thread has an Area."}
              </p>
            )}
          </section>
        ) : (
          <>
            <FoldedNoDate board={board} scope={scope} />
            <DashboardList board={board} scope={scope} />
          </>
        )}
      </div>

      {!empty && (
        <aside
          aria-label="No date"
          className="hidden min-w-0 pt-6 pb-24 [scrollbar-width:thin] lg:sticky lg:top-0 lg:-mr-3 lg:block lg:h-svh lg:self-start lg:overflow-y-auto lg:border-l lg:pr-3 lg:pl-8"
        >
          <NoDate board={board} scope={scope} />
        </aside>
      )}

      {openNote && (
        <StandaloneNoteDialog
          key={openNote._id}
          note={openNote}
          onOpenChange={(open) => {
            if (!open) setOpenNote(null);
          }}
        />
      )}
    </div>
  );
}
