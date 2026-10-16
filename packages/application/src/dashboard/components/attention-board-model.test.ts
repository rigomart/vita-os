import type { TaskId, Note, Thread } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import {
  boardItems,
  buildAttentionBoard,
  cardTask,
  groupByWhen,
  itemId,
  itemKey,
  unscheduledRuns,
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

  it("makes every Thread whose Tasks are all undated ready to move, once", () => {
    const board = buildAttentionBoard(
      [
        thread("no-tasks"),
        thread("one", { tasks: [task("Call")], order: 1 }),
        thread("several", {
          tasks: [task("Send the sheet"), task("Print")],
          order: 2,
        }),
      ],
      [],
      currentDate,
    );

    expect(board.unscheduled.moves.map(itemId)).toEqual(["one", "several"]);
    expect(board.unscheduled.open.map(itemId)).toEqual(["no-tasks"]);
    expect(
      board.unscheduled.moves.map(
        (item) => item.kind === "thread" && item.task,
      ),
    ).toEqual([undefined, undefined]);
  });

  it("places a copy of a Thread at every dated Task, and leaves its undated Tasks off the board", () => {
    const at = (offset: number, text: string) => ({
      _id: text as TaskId,
      text,
      date: day(offset),
    });
    const board = buildAttentionBoard(
      [
        thread("kitchen", {
          tasks: [
            at(4, "Call the plumber"),
            task("Find the receipt"),
            at(1, "Buy a washer"),
            at(1, "Return the old tap"),
          ],
        }),
      ],
      [],
      currentDate,
    );

    expect(board.week.map(itemKey)).toEqual([
      "kitchen:Buy a washer",
      "kitchen:Return the old tap",
      "kitchen:Call the plumber",
    ]);
    expect(board.week.map((item) => item.when)).toEqual([
      day(1),
      day(1),
      day(4),
    ]);
    expect(boardItems(board)).toHaveLength(3);
    expect(unscheduledRuns(board)).toEqual([]);
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

  it("lands every dated Task and Note in one group, and every undated item in one run", () => {
    const threads = [
      thread("late", { followUp: day(-2) }),
      thread("soon", {
        followUp: day(2),
        tasks: [{ _id: "far" as TaskId, text: "Far", date: day(30) }],
      }),
      thread("task", { tasks: [task("Do the thing")] }),
      thread("idle"),
    ];
    const notes = [
      note("dated-note", { followUp: day(1) }),
      note("loose-note"),
    ];
    const board = buildAttentionBoard(threads, notes, currentDate);
    const keys = boardItems(board).map(itemKey);

    // "soon" stands twice, once per dated Task.
    expect(keys).toHaveLength(threads.length + 1 + notes.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      unscheduledRuns(board).map((run) => [run.title, run.items.length]),
    ).toEqual([
      ["Ready to move", 1],
      ["Open", 1],
      ["Notes", 1],
    ]);
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
        hint: "in 2 days",
        exact: true,
        tone: "soon",
        items: ["d2", "d2"],
      },
      {
        label: "Wednesday",
        hint: "in 5 days",
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

describe("a repeating Task on the board", () => {
  const daily = {
    _id: "check-in" as TaskId,
    text: "Evening check-in",
    repeat: { kind: "days" as const, every: 1 },
  };

  it("shows a missed run as one Late card, never one per missed day", () => {
    // Three evenings missed: still one Task with one date.
    const recovery = thread("recovery", {
      tasks: [{ ...daily, date: day(-3) + 9 * 3_600_000 }],
    });
    const board = buildAttentionBoard([recovery], [], currentDate);

    expect(board.now.map(itemId)).toEqual(["recovery"]);
    expect(boardItems(board)).toHaveLength(1);
    expect(
      groupByWhen(board.now, currentDate).map((group) => ({
        key: group.key,
        items: group.items.map(itemId),
      })),
    ).toEqual([{ key: "late", items: ["recovery"] }]);
  });

  it("places one copy at the next occurrence, beside the Thread's other dated Tasks", () => {
    const recovery = thread("recovery", {
      tasks: [
        { ...daily, date: day(0) + 21 * 3_600_000 },
        { _id: "pickup" as TaskId, text: "Pickup", date: day(1) },
      ],
    });
    const board = buildAttentionBoard([recovery], [], currentDate);

    // A daily Repeat is one Task with one date: no copy for each day ahead.
    expect(boardItems(board).map(itemKey)).toEqual([
      "recovery:check-in",
      "recovery:pickup",
    ]);
  });
});

describe("cardTask", () => {
  const dated = { _id: "book" as TaskId, text: "Book", date: day(2) };

  it("names the Task that placed the copy, whatever else the Thread holds", () => {
    const busy = thread("busy", { tasks: [task("Call"), dated] });

    expect(cardTask(busy, dated)).toBe(dated);
  });

  it("names a No date card's only Task, and none of several", () => {
    const only = task("Call");

    expect(cardTask(thread("one", { tasks: [only] }))).toBe(only);
    expect(
      cardTask(thread("several", { tasks: [task("A"), task("B")] })),
    ).toBeUndefined();
    expect(cardTask(thread("empty"))).toBeUndefined();
  });
});
