import type { BoardScope } from "@vita-os/application/internal/dashboard/components/dashboard-item.tsx";
import type { Note } from "@vita-os/contracts";
import type { ComponentType } from "react";

import { useAreas, useOpenNotes, useOpenThreads } from "@vita-os/application";
import {
  boardItems,
  buildAttentionBoard,
  groupByWhen,
  type AttentionBoard,
  type BoardGroup,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { filterDashboard } from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";
import { DashboardFilter } from "@vita-os/application/internal/dashboard/components/dashboard-filter.tsx";
import { DashboardOverviewSkeleton } from "@vita-os/application/internal/dashboard/components/dashboard-overview-skeleton.tsx";
import {
  FoldedNoDate,
  NoDate,
} from "@vita-os/application/internal/dashboard/components/no-date.tsx";
import { ThreadCopies } from "@vita-os/application/internal/dashboard/components/thread-copies.tsx";
import { useAttentionClock } from "@vita-os/application/internal/hooks/use-attention-clock.ts";
import { useDashboardFilterParams } from "@vita-os/application/internal/navigation/use-dashboard-filter-params.ts";
import { StandaloneNoteDialog } from "@vita-os/application/internal/notes/note-view/standalone-note-dialog.tsx";
import { useState } from "react";

export interface ListProps {
  board: AttentionBoard;
  groups: BoardGroup[];
  scope: BoardScope;
}

/**
 * The Dashboard as it ships, filter, No date and all, with only the dated
 * list swapped for `List`. The chrome is the product's own shell.
 */
export function SectionsBoard({ List }: { List: ComponentType<ListProps> }) {
  const currentDate = useAttentionClock();
  const filter = useDashboardFilterParams();
  const areas = useAreas().data;
  const threads = useOpenThreads().data;
  const notes = useOpenNotes().data;
  const [openNote, setOpenNote] = useState<Note | null>(null);

  if (areas === undefined || threads === undefined || notes === undefined) {
    return <DashboardOverviewSkeleton />;
  }

  const filtered = filterDashboard({ threads, notes, areas, params: filter });
  const board = buildAttentionBoard(
    filtered.threads,
    filtered.notes,
    currentDate,
  );
  const groups = groupByWhen(
    [...board.now, ...board.week, ...board.later],
    currentDate,
  );
  const empty = boardItems(board).length === 0;
  const scope: BoardScope = {
    areaById: new Map(areas.map((area) => [area._id, area])),
    currentDate,
    onOpenNote: setOpenNote,
  };

  return (
    <div className="mx-auto grid max-w-[76rem] gap-x-12 px-4 sm:px-6 lg:min-h-full lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 lg:pb-16">
        <h1 className="sr-only">Dashboard</h1>
        <div className="sticky top-0 z-20 -mx-4 bg-surface-1/90 px-4 pt-5 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-3 lg:px-3">
          <DashboardFilter options={filtered.options} />
        </div>
        {empty ? (
          <p className="pt-6 text-sm text-muted-foreground">
            Nothing is asking for you.
          </p>
        ) : (
          <ThreadCopies>
            <FoldedNoDate board={board} scope={scope} />
            {groups.length === 0 ? (
              <p className="pt-2 text-[15px] text-muted-foreground">
                Nothing is on the calendar.
              </p>
            ) : (
              <div className="@container">
                <List board={board} groups={groups} scope={scope} />
              </div>
            )}
          </ThreadCopies>
        )}
      </div>

      {!empty && (
        <aside
          aria-label="No date"
          className="hidden min-w-0 pt-6 pb-24 [scrollbar-width:thin] lg:sticky lg:top-0 lg:-mr-3 lg:block lg:max-h-svh lg:overflow-y-auto lg:border-l lg:pr-3 lg:pl-8 lg:[contain:size]"
        >
          <ThreadCopies>
            <NoDate board={board} scope={scope} />
          </ThreadCopies>
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

/** The day a group stands for: its first item's, or today's for Late. */
export function groupDay(group: BoardGroup, currentDate: number) {
  return group.items[0]?.when ?? currentDate;
}

export function isFar(group: BoardGroup) {
  return group.tone === "far";
}
