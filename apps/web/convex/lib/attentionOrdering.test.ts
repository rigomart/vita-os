import { describe, expect, it } from "vitest";

import {
  groupAreaThreadsByAttention,
  groupTasksByAttention,
  groupThreadsByAttention,
  isOpenTask,
} from "./attentionOrdering";

const today = new Date(2026, 6, 17).getTime();

function thread(
  id: string,
  fields: {
    followUp?: number;
    nextMove?: string;
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
        thread("next-later", { nextMove: "Call", order: 3 }),
        thread("overdue-recent", { followUp: today - 86_400_000 }),
        thread("upcoming-sooner", { followUp: today + 86_400_000 }),
        thread("overdue-old", { followUp: today - 3 * 86_400_000 }),
        thread("next-sooner", { nextMove: "Email", order: 1 }),
        thread("open-sooner", { order: 0 }),
      ],
      today,
    );

    expect(groups.overdue.map((item) => item.id)).toEqual([
      "overdue-old",
      "overdue-recent",
    ]);
    expect(groups.withNextMoves.map((item) => item.id)).toEqual([
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
    ]);
  });

  it("keeps an Area inventory split between due-now and future Follow-ups", () => {
    const groups = groupAreaThreadsByAttention(
      [
        thread("future", { followUp: today + 86_400_000 }),
        thread("today", { followUp: today }),
        thread("overdue", { followUp: today - 86_400_000 }),
        thread("next", { nextMove: "Call" }),
        thread("open"),
      ],
      today,
    );

    expect(groups.dueNow.map((item) => item.id)).toEqual(["overdue", "today"]);
    expect(groups.upcoming.map((item) => item.id)).toEqual(["future"]);
    expect(groups.withNextMoves.map((item) => item.id)).toEqual(["next"]);
    expect(groups.open.map((item) => item.id)).toEqual(["open"]);
  });
});

function task(
  id: string,
  fields: {
    completedAt?: number;
    createdAt?: number;
    state?: "done" | "open";
    when?: number;
  } = {},
) {
  return {
    id,
    state: fields.state ?? "open",
    createdAt: fields.createdAt ?? 0,
    ...fields,
  };
}

describe("Task attention ordering", () => {
  it("orders every Inbox group by its attention rule", () => {
    const groups = groupTasksByAttention(
      [
        task("future-later", { when: today + 3 * 86_400_000 }),
        task("today-new", { when: today, createdAt: 8 }),
        task("done-old", { state: "done", completedAt: 10 }),
        task("undated-old", { createdAt: 2 }),
        task("past-recent", { when: today - 86_400_000 }),
        task("future-sooner", { when: today + 86_400_000 }),
        task("today-old", { when: today, createdAt: 3 }),
        task("past-old", { when: today - 4 * 86_400_000 }),
        task("done-new", { state: "done", completedAt: 20 }),
        task("undated-new", { createdAt: 9 }),
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

  it("counts every Open Task regardless of When", () => {
    const tasks = [
      task("undated"),
      task("scheduled", { when: today + 86_400_000 }),
      task("done", { state: "done" }),
    ];

    expect(tasks.filter(isOpenTask).map((item) => item.id)).toEqual([
      "undated",
      "scheduled",
    ]);
  });
});
