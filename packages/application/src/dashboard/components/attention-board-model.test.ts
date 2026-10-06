import type { TaskId, Note, Thread } from "@vita-os/contracts";

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
const task = (text: string) => ({ _id: text as TaskId, text });

/**
 * `followUp` reads as "the date this Thread comes back": the Thread holds a
 * Task with that date, which is all that places a Thread.
 */
function thread(
  id: string,
  { followUp, ...fields }: Partial<Thread> & { followUp?: number } = {},
): Thread {
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
    ...(followUp === undefined
      ? {}
      : {
          tasks: [
            ...(fields.tasks ?? []),
            { _id: `due-${id}` as TaskId, text: "Follow up", date: followUp },
          ],
        }),
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
      [note("late-note", { followUp: day(-1) })],
      currentDate,
    );

    expect(board.now.map(itemId)).toEqual(["late", "late-note", "today"]);
  });

  it("orders a day's items by their time, a date alone first", () => {
    const today = new Date(2026, 6, 17).getTime();
    const at = (hours: number, minutes = 0) =>
      new Date(2026, 6, 17, hours, minutes).getTime();
    const board = buildAttentionBoard(
      [
        thread("afternoon", { followUp: at(15) }),
        thread("all-day", { followUp: today }),
        thread("morning", { followUp: at(9, 30) }),
      ],
      [note("noon-note", { followUp: at(12) })],
      currentDate,
    );

    expect(board.now.map(itemId)).toEqual([
      "all-day",
      "morning",
      "noon-note",
      "afternoon",
    ]);
    expect(groupByWhen(board.now, currentDate).map((g) => g.key)).toEqual([
      "today",
    ]);
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
      [note("note", { followUp: day(2) })],
      currentDate,
    );

    expect(board.week.map(itemId)).toEqual(["note", "thread"]);
  });

  /**
   * The #236 answer: a Follow-up date outranks undated Tasks, so an
   * actionable-but-undated Thread never lands in Now — it keeps its own run in
   * the unscheduled margin instead.
   */
  it("sends undated Tasks to the unscheduled margin, not to Now", () => {
    const board = buildAttentionBoard(
      [
        thread("dated", { followUp: day(0) }),
        thread("actionable", { tasks: [task("Call the clinic")] }),
      ],
      [],
      currentDate,
    );

    expect(board.now.map(itemId)).toEqual(["dated"]);
    expect(board.unscheduled.moves.map(itemId)).toEqual(["actionable"]);
  });

  it("makes every Thread with a Task ready to move, whether or not one is focused", () => {
    const focused = task("Send the sheet");
    const board = buildAttentionBoard(
      [
        thread("no-tasks"),
        thread("unfocused", {
          tasks: [task("Call"), task("Email")],
          order: 1,
        }),
        thread("focused", {
          tasks: [focused, task("Print")],
          focusedTaskId: focused._id,
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
    expect(board.unscheduled.open.map(itemId)).toEqual(["no-tasks"]);
  });

  it("never moves a Thread between columns for focus", () => {
    const focused = task("Send the sheet");
    const dated = { followUp: day(2), tasks: [focused, task("Print")] };
    const unfocused = buildAttentionBoard(
      [thread("dated", dated)],
      [],
      currentDate,
    );
    const withFocus = buildAttentionBoard(
      [thread("dated", { ...dated, focusedTaskId: focused._id })],
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
      thread("task", { tasks: [task("Do the thing")] }),
      thread("idle"),
    ];
    const notes = [
      note("dated-note", { followUp: day(1) }),
      note("loose-note"),
    ];
    const board = buildAttentionBoard(threads, notes, currentDate);
    const ids = boardItems(board).map(itemId);

    expect(ids).toHaveLength(threads.length + notes.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(unscheduledCount(board)).toBe(3);
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
