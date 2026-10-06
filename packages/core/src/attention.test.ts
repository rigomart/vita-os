import { describe, expect, it } from "vitest";

import {
  attentionDate,
  groupThreadsByAttention,
  soonestTaskDate,
  timeOfDay,
  withTimeOfDay,
} from "./attention";

const today = new Date(2026, 6, 17).getTime();

function thread(
  id: string,
  fields: {
    tasks?: { text: string; date?: number }[];
    order?: number;
  } = {},
) {
  return { id, order: fields.order ?? 0, ...fields };
}

const DAY = 86_400_000;

describe("Thread attention ordering", () => {
  it("groups Threads by attention and preserves user order for equal states", () => {
    const groups = groupThreadsByAttention(
      [
        thread("open-later", { order: 2 }),
        thread("upcoming-later", {
          tasks: [{ text: "x", date: today + 2 * 86_400_000 }],
        }),
        thread("next-later", { tasks: [{ text: "Call" }], order: 3 }),
        thread("overdue-recent", {
          tasks: [{ text: "x", date: today - 86_400_000 }],
        }),
        thread("upcoming-sooner", {
          tasks: [{ text: "x", date: today + 86_400_000 }],
        }),
        thread("overdue-old", {
          tasks: [{ text: "x", date: today - 3 * 86_400_000 }],
        }),
        thread("next-sooner", {
          tasks: [{ text: "Email" }, { text: "Book" }],
          order: 1,
        }),
        thread("open-sooner", { order: 0 }),
        thread("emptied", { tasks: [], order: 4 }),
      ],
      today,
    );

    expect(groups.overdue.map((item) => item.id)).toEqual([
      "overdue-old",
      "overdue-recent",
    ]);
    expect(groups.withTasks.map((item) => item.id)).toEqual([
      "next-sooner",
      "next-later",
    ]);
    expect(groups.upcoming.map((item) => item.id)).toEqual([
      "upcoming-sooner",
      "upcoming-later",
    ]);
    expect(groups.open.map((item) => item.id)).toEqual([
      "open-sooner",
      "open-later",
      "emptied",
    ]);
  });
});

describe("Thread attention by dated Task", () => {
  it("places a Thread by its soonest dated Task", () => {
    const groups = groupThreadsByAttention(
      [
        thread("later", {
          tasks: [{ text: "A", date: today + 5 * DAY }, { text: "B" }],
        }),
        thread("soonest", {
          tasks: [
            { text: "A", date: today + 5 * DAY },
            { text: "B", date: today - DAY },
          ],
          order: 1,
        }),
        thread("tomorrow", { tasks: [{ text: "A", date: today + DAY }] }),
      ],
      today,
    );

    expect(groups.overdue.map((item) => item.id)).toEqual(["soonest"]);
    expect(groups.upcoming.map((item) => item.id)).toEqual([
      "tomorrow",
      "later",
    ]);
  });

  it("is ready to move only with undated Tasks, and open with none", () => {
    const groups = groupThreadsByAttention(
      [
        thread("undated", { tasks: [{ text: "A" }, { text: "B" }] }),
        thread("none", { order: 1 }),
      ],
      today,
    );

    expect(groups.withTasks.map((item) => item.id)).toEqual(["undated"]);
    expect(groups.open.map((item) => item.id)).toEqual(["none"]);
    expect(groups.upcoming).toEqual([]);
  });

  it("puts every Thread in exactly one group", () => {
    const threads = [
      thread("a", { tasks: [{ text: "x", date: today }] }),
      thread("b", { tasks: [{ text: "x" }] }),
      thread("c"),
      thread("d", { tasks: [{ text: "x", date: today + DAY }] }),
    ];
    const groups = groupThreadsByAttention(threads, today);

    expect(
      [
        ...groups.overdue,
        ...groups.upcoming,
        ...groups.withTasks,
        ...groups.open,
      ]
        .map((item) => item.id)
        .sort(),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("orders a day's date-only Task before its timed ones", () => {
    const groups = groupThreadsByAttention(
      [
        thread("timed", {
          tasks: [{ text: "x", date: today + DAY + 15 * 3_600_000 }],
        }),
        thread("date-only", { tasks: [{ text: "x", date: today + DAY }] }),
        thread("morning", {
          tasks: [{ text: "x", date: today + DAY + 9 * 3_600_000 }],
        }),
      ],
      today,
    );

    expect(groups.upcoming.map((item) => item.id)).toEqual([
      "date-only",
      "morning",
      "timed",
    ]);
  });

  it("brings a Thread back at the soonest date among its Tasks", () => {
    const date = today + 3 * DAY;
    expect(soonestTaskDate([{ date }, { date: date + DAY }, {}])).toBe(date);
    expect(soonestTaskDate([{}])).toBeUndefined();
    expect(attentionDate({ tasks: [{ date: date + DAY }, { date }] })).toBe(
      date,
    );
    expect(attentionDate({ tasks: [{}] })).toBeUndefined();
    expect(attentionDate({})).toBeUndefined();
  });
});

describe("time of day", () => {
  it("reads local midnight as a date with no time", () => {
    expect(timeOfDay(new Date(2026, 6, 17).getTime())).toBeUndefined();
    expect(timeOfDay(new Date(2026, 6, 17, 9, 5).getTime())).toBe("09:05");
    expect(timeOfDay(new Date(2026, 6, 17, 15, 30).getTime())).toBe("15:30");
  });

  it("puts a day at a time, or back to the day alone", () => {
    const afternoon = new Date(2026, 6, 17, 15, 30).getTime();

    expect(withTimeOfDay(afternoon, "09:15")).toBe(
      new Date(2026, 6, 17, 9, 15).getTime(),
    );
    expect(withTimeOfDay(afternoon)).toBe(new Date(2026, 6, 17).getTime());
    expect(withTimeOfDay(afternoon, "")).toBe(new Date(2026, 6, 17).getTime());
  });
});
