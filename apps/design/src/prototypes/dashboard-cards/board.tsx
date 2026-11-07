import type { AttentionBoard } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import type { BoardScope } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import type { Note } from "@vita-os/contracts";
import type { ComponentType } from "react";

import { useAreas } from "@vita-os/application/internal/areas/hooks.ts";
import { buildAttentionBoard } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { filterDashboard } from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";
import { DashboardFilter } from "@vita-os/application/internal/dashboard/components/dashboard-filter.tsx";
import { ThreadCopies } from "@vita-os/application/internal/dashboard/components/thread-copies.tsx";
import { useAttentionClock } from "@vita-os/application/internal/hooks/use-attention-clock.ts";
import { useDashboardFilterParams } from "@vita-os/application/internal/navigation/use-dashboard-filter-params.ts";
import { useOpenNotes } from "@vita-os/application/internal/notes/hooks.ts";
import { StandaloneNoteDialog } from "@vita-os/application/internal/notes/note-view/standalone-note-dialog.tsx";
import { useOpenThreads } from "@vita-os/application/internal/threads/hooks.ts";
import { useState } from "react";

export interface BodyProps {
  board: AttentionBoard;
  scope: BoardScope;
}

export function ShapeBoard({ Body }: { Body: ComponentType<BodyProps> }) {
  const currentDate = useAttentionClock();
  const params = useDashboardFilterParams();
  const areas = useAreas().data;
  const threads = useOpenThreads().data;
  const notes = useOpenNotes().data;
  const [openNote, setOpenNote] = useState<Note | null>(null);

  if (areas === undefined || threads === undefined || notes === undefined) {
    return null;
  }
  const filtered = filterDashboard({ threads, notes, areas, params });
  const board = buildAttentionBoard(
    filtered.threads,
    filtered.notes,
    currentDate,
  );
  const scope: BoardScope = {
    areaById: new Map(areas.map((area) => [area._id, area])),
    currentDate,
    onOpenNote: setOpenNote,
  };

  return (
    <div className="mx-auto max-w-[76rem] px-4 pb-10 sm:px-6">
      <h1 className="sr-only">Dashboard</h1>
      <div className="sticky top-0 z-20 -mx-4 bg-surface-1/90 px-4 pt-5 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <DashboardFilter options={filtered.options} />
      </div>
      <ThreadCopies>
        <Body board={board} scope={scope} />
      </ThreadCopies>
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
