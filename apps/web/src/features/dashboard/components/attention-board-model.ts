import type { ProjectedNote, ProjectedThread } from "@convex/lib/validators";

import { dayDelta } from "./dashboard-model";

/**
 * The Dashboard board is one axis — **when** — plus a margin for everything
 * that has no place on it.
 *
 * Three columns carry the dates (Now · This week · Later), and a single
 * unscheduled group carries what is not on the calendar at all: Threads with a
 * Next Move ready to be made, Threads simply open, and standalone Notes.
 * Follow-ups and Note attention dates are the same kind of signal here, so a
 * Note due tomorrow sits beside a Thread due tomorrow.
 *
 * A dated item never appears in the unscheduled group and vice versa, so every
 * open Thread and open Note lands in exactly one place.
 */
export interface AttentionBoard {
  later: BoardItem[];
  now: BoardItem[];
  unscheduled: {
    /** Threads with a Next Move but no date: what you could do today. */
    moves: BoardItem[];
    /** Standalone Notes with no attention date. */
    notes: BoardItem[];
    /** Threads with neither a date nor a captured move. */
    open: BoardItem[];
  };
  week: BoardItem[];
}

export type BoardItem =
  | { kind: "note"; note: ProjectedNote; when?: number }
  | { kind: "thread"; thread: ProjectedThread; when?: number };

/** The last six days of "soon" — day 7 and beyond reads as Later. */
const WEEK_HORIZON = 6;

export function buildAttentionBoard(
  threads: ProjectedThread[],
  notes: ProjectedNote[],
  currentDate: number,
): AttentionBoard {
  const items: BoardItem[] = [
    ...threads.map(
      (thread): BoardItem => ({
        kind: "thread",
        thread,
        when: thread.followUp ?? undefined,
      }),
    ),
    ...notes.map(
      (note): BoardItem => ({
        kind: "note",
        note,
        when: note.when ?? undefined,
      }),
    ),
  ];

  const dated = items.filter((item) => item.when !== undefined);
  const inDays = (item: BoardItem) => dayDelta(item.when ?? 0, currentDate);

  return {
    now: dated.filter((item) => inDays(item) <= 0).sort(bySoonest),
    week: dated
      .filter((item) => inDays(item) >= 1 && inDays(item) <= WEEK_HORIZON)
      .sort(bySoonest),
    later: dated.filter((item) => inDays(item) > WEEK_HORIZON).sort(bySoonest),
    unscheduled: {
      moves: threads
        .filter((thread) => thread.followUp == null && hasText(thread.nextMove))
        .sort(byThreadOrder)
        .map((thread) => ({ kind: "thread", thread })),
      open: threads
        .filter(
          (thread) => thread.followUp == null && !hasText(thread.nextMove),
        )
        .sort(byThreadOrder)
        .map((thread) => ({ kind: "thread", thread })),
      notes: notes
        .filter((note) => note.when == null)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((note) => ({ kind: "note", note })),
    },
  };
}

/** Every open item on the board, for the counts in the header. */
export function boardItems(board: AttentionBoard): BoardItem[] {
  return [
    ...board.now,
    ...board.week,
    ...board.later,
    ...board.unscheduled.moves,
    ...board.unscheduled.open,
    ...board.unscheduled.notes,
  ];
}

export function unscheduledCount(board: AttentionBoard) {
  return (
    board.unscheduled.moves.length +
    board.unscheduled.open.length +
    board.unscheduled.notes.length
  );
}

/** The Thread or Note behind an item, whichever it is. */
export function itemId(item: BoardItem) {
  return item.kind === "thread" ? item.thread._id : item.note._id;
}

export function itemAreaId(item: BoardItem) {
  return item.kind === "thread" ? item.thread.areaId : undefined;
}

function bySoonest(a: BoardItem, b: BoardItem) {
  return (a.when ?? 0) - (b.when ?? 0);
}

function byThreadOrder(a: ProjectedThread, b: ProjectedThread) {
  return a.order - b.order;
}

function hasText(value: string | null | undefined) {
  return value != null && value.trim().length > 0;
}
