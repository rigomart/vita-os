import type {
  AttentionBoard,
  BoardItem,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import type { BoardScope } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import type { Note } from "@vita-os/contracts";
import type { ComponentType } from "react";

import { useAreas } from "@vita-os/application/internal/areas/hooks.ts";
import {
  buildAttentionBoard,
  groupByWhen,
  unscheduledRuns,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { filterDashboard } from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";
import { DashboardFilter } from "@vita-os/application/internal/dashboard/components/dashboard-filter.tsx";
import { ThreadCopies } from "@vita-os/application/internal/dashboard/components/thread-copies.tsx";
import { useAttentionClock } from "@vita-os/application/internal/hooks/use-attention-clock.ts";
import { useDashboardFilterParams } from "@vita-os/application/internal/navigation/use-dashboard-filter-params.ts";
import { useOpenNotes } from "@vita-os/application/internal/notes/hooks.ts";
import { StandaloneNoteDialog } from "@vita-os/application/internal/notes/note-view/standalone-note-dialog.tsx";
import { useOpenThreads } from "@vita-os/application/internal/threads/hooks.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { useState } from "react";

/**
 * The board cut into the five spans a person reads it by: what is late,
 * what is today, the rest of the week, later, and what has no date. Every
 * item is in exactly one. `distance` is the list's grading, 0 nearest.
 */
export interface Band {
  key: "late" | "today" | "week" | "later" | "none";
  label: string;
  items: BoardItem[];
  /** How far off it reads, as ADR 0045 grades the list: 0 is Late and Today. */
  distance: number;
}

export interface BodyProps {
  bands: Band[];
  board: AttentionBoard;
  scope: BoardScope;
}

export function toBands(board: AttentionBoard, currentDate: number): Band[] {
  const now = groupByWhen(board.now, currentDate);
  const late = now.filter((group) => group.tone === "late");
  const today = now.filter((group) => group.tone === "today");
  return [
    {
      key: "late",
      label: "Late",
      items: late.flatMap((g) => g.items),
      distance: 0,
    },
    {
      key: "today",
      label: "Today",
      items: today.flatMap((g) => g.items),
      distance: 0,
    },
    { key: "week", label: "This week", items: board.week, distance: 2 },
    { key: "later", label: "Later", items: board.later, distance: 4 },
    {
      key: "none",
      label: "No date",
      items: unscheduledRuns(board).flatMap((run) => run.items),
      distance: 2,
    },
  ];
}

/**
 * The Dashboard's data, filter and Note dialog as they ship, around a body
 * that draws the board another way.
 */
export function ShapeBoard({
  Body,
  wide = false,
}: {
  Body: ComponentType<BodyProps>;
  wide?: boolean;
}) {
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
    <div
      className={cn(
        "mx-auto px-4 pb-10 sm:px-6",
        wide ? "max-w-[88rem]" : "max-w-[76rem]",
      )}
    >
      <h1 className="sr-only">Dashboard</h1>
      <div className="pt-5 pb-4">
        <DashboardFilter options={filtered.options} />
      </div>
      <ThreadCopies>
        <Body bands={toBands(board, currentDate)} board={board} scope={scope} />
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

/**
 * A band's count, large enough to read before any title. Always in neutral
 * ink, Late's too: a coloured overdue count is the pressure the thesis keeps
 * out. Only the word Late carries the attention colour, as it ships.
 */
export function BandCount({
  band,
  className,
}: {
  band: Band;
  className?: string;
}) {
  return <Count count={band.items.length} className={className} />;
}

export function Count({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-heading font-semibold tabular-nums",
        count === 0 && "text-muted-foreground/40",
        className,
      )}
    >
      {count}
    </span>
  );
}

/** A span's or a day's name, Late in the attention colour when it holds any. */
export function SpanLabel({
  label,
  late,
  className,
}: {
  label: string;
  late: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-heading font-semibold tracking-tight",
        late && "text-condition-attention",
        className,
      )}
    >
      {label}
    </span>
  );
}
