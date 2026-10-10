import type { AreaSummary, Note } from "@vita-os/contracts";

import type { BoardItem } from "./attention-board-model";

import { ConnectedThreadAttentionCard } from "../../threads/components/thread-attention-card";
import { DashboardNote } from "./dashboard-note";

/** What every item on the Dashboard needs to draw itself. */
export interface BoardScope {
  areaById: ReadonlyMap<string, AreaSummary>;
  currentDate: number;
  onOpenNote: (note: Note) => void;
}

/** One item on the board, in the card it wears: a Thread's or a Note's. */
export function DashboardItem({
  dateInHeading = false,
  item,
  onLateFill = false,
  scope,
}: {
  /** The heading above names this item's day. */
  dateInHeading?: boolean;
  item: BoardItem;
  /** The card sits on Late's fill, so it drops its own late tint. */
  onLateFill?: boolean;
  scope: BoardScope;
}) {
  if (item.kind === "note") {
    return (
      <DashboardNote
        currentDate={scope.currentDate}
        dateInHeading={dateInHeading}
        note={item.note}
        onLateFill={onLateFill}
        onOpenNote={scope.onOpenNote}
      />
    );
  }
  const { areaId } = item.thread;
  return (
    <ConnectedThreadAttentionCard
      area={areaId === undefined ? undefined : scope.areaById.get(areaId)}
      currentDate={scope.currentDate}
      dateInHeading={dateInHeading}
      onLateFill={onLateFill}
      thread={item.thread}
    />
  );
}
