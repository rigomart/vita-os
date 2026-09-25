import type { Note, Thread } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import {
  boardItems,
  buildAttentionBoard,
  itemId,
  unscheduledCount,
} from "./attention-board-model";
import { DAY } from "./dashboard-model";

const currentDate = new Date(2026, 6, 17, 12).getTime();
const day = (offset: number) => currentDate + offset * DAY;

function thread(id: string, fields: Partial<Thread> = {}): Thread {
  return {
    _id: id as Thread["_id"],
    title: id,
    slug: id,
    areaId: "area-1" as Thread["areaId"],
    order: 0,
    state: "open",
    revision: 0,
    createdAt: currentDate,
    ...fields,
  } as Thread;
}

function note(id: string, fields: Partial<Note> = {}): Note {
  return {
    _id: id as Note["_id"],
    body: id,
    state: "open",
    revision: 0,
    createdAt: currentDate,
    ...fields,
  } as Note;
}

describe("buildAttentionBoard", () => {
  it("puts overdue and due-today items in Now, soonest first", () => {
    const board = buildAttentionBoard(
      [
        thread("today", { followUp: day(0) }),
        thread("late", { followUp: day(-3) }),
      ],
      [note("late-note", { attentionDate: day(-1) })],
      currentDate,
    );

    expect(board.now.map(itemId)).toEqual(["late", "late-note", "today"]);
  });

  it("splits the future at six days", () => {
    const board = buildAttentionBoard(
      [
        thread("tomorrow", { followUp: day(1) }),
        thread("edge-of-week", { followUp: day(6) }),
        thread("next-week", { followUp: day(7) }),
      ],
      [],
      currentDate,
    );

    expect(board.week.map(itemId)).toEqual(["tomorrow", "edge-of-week"]);
    expect(board.later.map(itemId)).toEqual(["next-week"]);
  });

  it("keeps dated Notes beside dated Threads rather than apart", () => {
    const board = buildAttentionBoard(
      [thread("thread", { followUp: day(3) })],
      [note("note", { attentionDate: day(2) })],
      currentDate,
    );

    expect(board.week.map(itemId)).toEqual(["note", "thread"]);
  });

  /**
   * The #236 answer: a Follow-up date outranks an undated Next Move, so an
   * actionable-but-undated Thread never lands in Now — it keeps its own run in
   * the unscheduled margin instead.
   */
  it("sends undated Next Moves to the unscheduled margin, not to Now", () => {
    const board = buildAttentionBoard(
      [
        thread("dated", { followUp: day(0) }),
        thread("actionable", { nextMove: "Call the clinic" }),
      ],
      [],
      currentDate,
    );

    expect(board.now.map(itemId)).toEqual(["dated"]);
    expect(board.unscheduled.moves.map(itemId)).toEqual(["actionable"]);
  });

  it("separates undated Threads by whether a move is captured", () => {
    const board = buildAttentionBoard(
      [
        thread("blank-move", { nextMove: "   " }),
        thread("with-move", { nextMove: "Send the sheet", order: 1 }),
      ],
      [],
      currentDate,
    );

    expect(board.unscheduled.moves.map(itemId)).toEqual(["with-move"]);
    expect(board.unscheduled.open.map(itemId)).toEqual(["blank-move"]);
  });

  it("collects undated Notes newest first", () => {
    const board = buildAttentionBoard(
      [],
      [
        note("older", { createdAt: day(-4) }),
        note("newer", { createdAt: day(-1) }),
      ],
      currentDate,
    );

    expect(board.unscheduled.notes.map(itemId)).toEqual(["newer", "older"]);
  });

  it("lands every item in exactly one place", () => {
    const threads = [
      thread("late", { followUp: day(-2) }),
      thread("soon", { followUp: day(2) }),
      thread("far", { followUp: day(30) }),
      thread("move", { nextMove: "Do the thing" }),
      thread("idle"),
    ];
    const notes = [
      note("dated-note", { attentionDate: day(1) }),
      note("loose-note"),
    ];
    const board = buildAttentionBoard(threads, notes, currentDate);
    const ids = boardItems(board).map(itemId);

    expect(ids).toHaveLength(threads.length + notes.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(unscheduledCount(board)).toBe(3);
  });

  it("treats a null Follow-up as unscheduled", () => {
    const board = buildAttentionBoard(
      [
        {
          ...thread("cleared"),
          // Cleared optional fields arrive as null.
          followUp: null,
          nextMove: null,
        } as unknown as Thread,
      ],
      [],
      currentDate,
    );

    expect(board.unscheduled.open.map(itemId)).toEqual(["cleared"]);
  });
});
