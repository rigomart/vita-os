import { describe, expect, it } from "vitest";

import {
  groupNotesByAttention,
  groupThreadsByAttention,
  isOpenNote,
  timeOfDay,
  withTimeOfDay,
} from "./attention";

const today = new Date(2026, 6, 17).getTime();

function thread(
  id: string,
  fields: {
    followUp?: number;
    moves?: string[];
    order?: number;
  } = {},
) {
  return { id, order: fields.order ?? 0, ...fields };
}

describe("Thread attention ordering", () => {
  it("groups Threads by attention and preserves user order for equal states", () => {
    const groups = groupThreadsByAttention(
      [
        thread("open-later", { order: 2 }),
        thread("upcoming-later", { followUp: today + 2 * 86_400_000 }),
        thread("next-later", { moves: ["Call"], order: 3 }),
        thread("overdue-recent", { followUp: today - 86_400_000 }),
        thread("upcoming-sooner", { followUp: today + 86_400_000 }),
        thread("overdue-old", { followUp: today - 3 * 86_400_000 }),
        thread("next-sooner", { moves: ["Email", "Book"], order: 1 }),
        thread("open-sooner", { order: 0 }),
        thread("emptied", { moves: [], order: 4 }),
      ],
      today,
    );

    expect(groups.overdue.map((item) => item.id)).toEqual([
      "overdue-old",
      "overdue-recent",
    ]);
    expect(groups.withMoves.map((item) => item.id)).toEqual([
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

function note(
  id: string,
  fields: {
    completedAt?: number;
    createdAt?: number;
    state?: "done" | "open";
    followUp?: number;
  } = {},
) {
  return {
    id,
    state: fields.state ?? "open",
    createdAt: fields.createdAt ?? 0,
    ...fields,
  };
}

describe("Note attention ordering", () => {
  it("orders every Inbox group by its attention rule", () => {
    const groups = groupNotesByAttention(
      [
        note("future-later", { followUp: today + 3 * 86_400_000 }),
        note("today-new", { followUp: today, createdAt: 8 }),
        note("done-old", { state: "done", completedAt: 10 }),
        note("undated-old", { createdAt: 2 }),
        note("past-recent", { followUp: today - 86_400_000 }),
        note("future-sooner", { followUp: today + 86_400_000 }),
        note("today-old", { followUp: today, createdAt: 3 }),
        note("past-old", { followUp: today - 4 * 86_400_000 }),
        note("done-new", { state: "done", completedAt: 20 }),
        note("undated-new", { createdAt: 9 }),
      ],
      today,
    );

    expect(groups.pastDue.map((item) => item.id)).toEqual([
      "past-old",
      "past-recent",
    ]);
    expect(groups.today.map((item) => item.id)).toEqual([
      "today-new",
      "today-old",
    ]);
    expect(groups.noDate.map((item) => item.id)).toEqual([
      "undated-new",
      "undated-old",
    ]);
    expect(groups.comingUp.map((item) => item.id)).toEqual([
      "future-sooner",
      "future-later",
    ]);
    expect(groups.completed.map((item) => item.id)).toEqual([
      "done-new",
      "done-old",
    ]);
  });

  it("counts every Open Note regardless of When", () => {
    const notes = [
      note("undated"),
      note("scheduled", { followUp: today + 86_400_000 }),
      note("done", { state: "done" }),
    ];

    expect(notes.filter(isOpenNote).map((item) => item.id)).toEqual([
      "undated",
      "scheduled",
    ]);
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
