import { describe, expect, it } from "vitest";

import { groupThreadsByAttention, timeOfDay, withTimeOfDay } from "./attention";

const today = new Date(2026, 6, 17).getTime();

function thread(
  id: string,
  fields: {
    followUp?: number;
    tasks?: string[];
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
        thread("next-later", { tasks: ["Call"], order: 3 }),
        thread("overdue-recent", { followUp: today - 86_400_000 }),
        thread("upcoming-sooner", { followUp: today + 86_400_000 }),
        thread("overdue-old", { followUp: today - 3 * 86_400_000 }),
        thread("next-sooner", { tasks: ["Email", "Book"], order: 1 }),
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
