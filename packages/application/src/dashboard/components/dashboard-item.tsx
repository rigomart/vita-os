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

/** One item in No date, in the card it wears: a Note's or a Thread's. */
export function DashboardItem({
  item,
  scope,
}: {
  item: BoardItem;
  scope: BoardScope;
}) {
  if (item.kind === "note") {
    return (
      <DashboardNote
        currentDate={scope.currentDate}
        note={item.note}
        onOpenNote={scope.onOpenNote}
      />
    );
  }
  const { areaId } = item.thread;
  return (
    <ConnectedThreadAttentionCard
      area={areaId === undefined ? undefined : scope.areaById.get(areaId)}
      currentDate={scope.currentDate}
      thread={item.thread}
    />
  );
}
