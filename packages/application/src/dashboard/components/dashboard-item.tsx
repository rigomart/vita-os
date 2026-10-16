import type { AreaSummary, Note } from "@vita-os/contracts";

import type { BoardItem } from "./attention-board-model";

import { ConnectedThreadAttentionCard } from "../../threads/components/thread-attention-card";
import { DashboardNote } from "./dashboard-note";
import { ThreadCopy } from "./thread-copies";

/** What every item on the Dashboard needs to draw itself. */
export interface BoardScope {
  areaById: ReadonlyMap<string, AreaSummary>;
  currentDate: number;
  onOpenNote: (note: Note) => void;
}

/**
 * One item on the board, in the card it wears: a Note's, or one copy of a
 * Thread's, led by the Task that placed it.
 */
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
    <ThreadCopy thread={item.thread} className="h-full rounded-xl">
      <ConnectedThreadAttentionCard
        area={areaId === undefined ? undefined : scope.areaById.get(areaId)}
        currentDate={scope.currentDate}
        dateInHeading={dateInHeading}
        onLateFill={onLateFill}
        task={item.task}
        thread={item.thread}
      />
    </ThreadCopy>
  );
}
