import type { MoveId, Note, Thread } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import {
  boardItems,
  buildAttentionBoard,
  groupByWhen,
  itemId,
  unscheduledCount,
} from "./attention-board-model";
import { DAY } from "./dashboard-model";

const currentDate = new Date(2026, 6, 17, 12).getTime();
const day = (offset: number) => currentDate + offset * DAY;
const move = (text: string) => ({ _id: text as MoveId, text });

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
   * The #236 answer: a Follow-up date outranks undated Moves, so an
   * actionable-but-undated Thread never lands in Now — it keeps its own run in
   * the unscheduled margin instead.
   */
  it("sends undated Moves to the unscheduled margin, not to Now", () => {
    const board = buildAttentionBoard(
      [
        thread("dated", { followUp: day(0) }),
        thread("actionable", { moves: [move("Call the clinic")] }),
      ],
      [],
      currentDate,
    );

    expect(board.now.map(itemId)).toEqual(["dated"]);
    expect(board.unscheduled.moves.map(itemId)).toEqual(["actionable"]);
  });

  it("makes every Thread with a Move ready to move, whether or not one is focused", () => {
    const focused = move("Send the sheet");
    const board = buildAttentionBoard(
      [
        thread("no-moves"),
        thread("unfocused", {
          moves: [move("Call"), move("Email")],
          order: 1,
        }),
        thread("focused", {
          moves: [focused, move("Print")],
          focusedMoveId: focused._id,
          order: 2,
        }),
      ],
      [],
      currentDate,
    );

    expect(board.unscheduled.moves.map(itemId)).toEqual([
      "unfocused",
      "focused",
    ]);
    expect(board.unscheduled.open.map(itemId)).toEqual(["no-moves"]);
  });

  it("never moves a Thread between columns for focus", () => {
    const focused = move("Send the sheet");
    const dated = { followUp: day(2), moves: [focused, move("Print")] };
    const unfocused = buildAttentionBoard(
      [thread("dated", dated)],
      [],
      currentDate,
    );
    const withFocus = buildAttentionBoard(
      [thread("dated", { ...dated, focusedMoveId: focused._id })],
      [],
      currentDate,
    );

    expect(withFocus.week.map(itemId)).toEqual(unfocused.week.map(itemId));
    expect(withFocus.week.map(itemId)).toEqual(["dated"]);
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
      thread("move", { moves: [move("Do the thing")] }),
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
        } as unknown as Thread,
      ],
      [],
      currentDate,
    );

    expect(board.unscheduled.open.map(itemId)).toEqual(["cleared"]);
  });
});

describe("groupByWhen", () => {
  const groupsOf = (...offsets: number[]) => {
    const board = buildAttentionBoard(
      offsets.map((offset, order) =>
        thread(`d${offset}`, { followUp: day(offset), order }),
      ),
      [],
      currentDate,
    );
    return groupByWhen(
      [...board.now, ...board.week, ...board.later],
      currentDate,
    ).map(({ items, key: _key, ...group }) => ({
      ...group,
      items: items.map(itemId),
    }));
  };

  it("splits Now into Late and Today, and only Today names the cards' day", () => {
    expect(groupsOf(-3, -1, 0)).toEqual([
      { label: "Late", exact: false, tone: "late", items: ["d-3", "d-1"] },
      { label: "Today", exact: true, tone: "today", items: ["d0"] },
    ]);
  });

  it("gives each day of the week ahead that has something due its own heading", () => {
    expect(groupsOf(1, 2, 2, 5)).toEqual([
      {
        label: "Tomorrow",
        hint: "Saturday",
        exact: true,
        tone: "near",
        items: ["d1"],
      },
      {
        label: "Sunday",
        hint: "2d",
        exact: true,
        tone: "soon",
        items: ["d2", "d2"],
      },
      {
        label: "Wednesday",
        hint: "5d",
        exact: true,
        tone: "week",
        items: ["d5"],
      },
    ]);
  });

  it("widens Later's grain to weeks, then months", () => {
    expect(groupsOf(7, 13, 14, 27, 28, 200)).toEqual([
      {
        label: "In 1 week",
        hint: "Jul 24–30",
        exact: false,
        tone: "far",
        items: ["d7", "d13"],
      },
      {
        label: "In 2 weeks",
        hint: "Jul 31–Aug 6",
        exact: false,
        tone: "far",
        items: ["d14"],
      },
      {
        label: "In 3 weeks",
        hint: "Aug 7–13",
        exact: false,
        tone: "far",
        items: ["d27"],
      },
      { label: "August", exact: false, tone: "far", items: ["d28"] },
      { label: "February 2027", exact: false, tone: "far", items: ["d200"] },
    ]);
  });
});
