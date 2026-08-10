import type { Doc, Id } from "@convex/_generated/dataModel";

import { describe, expect, it } from "vitest";

import {
  isTaskWhenDue,
  isTaskWhenEmphasized,
  isUnprocessedTask,
  removeTaskFromInbox,
  updateTaskWhenInInbox,
} from "./inbox";

function makeTask(overrides: Partial<Doc<"tasks">> = {}): Doc<"tasks"> {
  return {
    _id: "task1" as Id<"tasks">,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

const may18_2026 = new Date(2026, 4, 18, 12).getTime();
const may19_2026 = new Date(2026, 4, 19, 12).getTime();
const may17_2026 = new Date(2026, 4, 17, 12).getTime();

describe("Task When emphasis", () => {
  it("treats When on or before today as due", () => {
    expect(isTaskWhenDue(may18_2026, may18_2026)).toBe(true);
    expect(isTaskWhenDue(may17_2026, may18_2026)).toBe(true);
    expect(isTaskWhenDue(may19_2026, may18_2026)).toBe(false);
    expect(isTaskWhenDue(undefined, may18_2026)).toBe(false);
  });

  it("emphasizes Open Tasks with due When", () => {
    expect(
      isTaskWhenEmphasized(makeTask({ when: may17_2026 }), may18_2026),
    ).toBe(true);
    expect(
      isTaskWhenEmphasized(makeTask({ when: may19_2026 }), may18_2026),
    ).toBe(false);
    expect(
      isTaskWhenEmphasized(
        makeTask({ when: may17_2026, state: "done" }),
        may18_2026,
      ),
    ).toBe(false);
  });
});

describe("Task inbox mutations", () => {
  it("removes a Task from the open Inbox list — completing and discarding both take it out", () => {
    const keeping = makeTask({ _id: "keeping" as Id<"tasks"> });
    const removing = makeTask({ _id: "removing" as Id<"tasks"> });

    expect(removeTaskFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("is a no-op when the Task isn't in the cached open list", () => {
    const keeping = makeTask({ _id: "keeping" as Id<"tasks"> });

    expect(removeTaskFromInbox([keeping], "elsewhere" as Id<"tasks">)).toEqual([
      keeping,
    ]);
  });

  it("updates or clears Task When without removing the Task from the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"tasks"> });

    const withWhen = updateTaskWhenInInbox(
      [updating, unchanged],
      updating._id,
      may19_2026,
    );

    expect(withWhen).toEqual([{ ...updating, when: may19_2026 }, unchanged]);
    expect(updateTaskWhenInInbox(withWhen, updating._id, undefined)).toEqual([
      { ...updating, when: undefined },
      unchanged,
    ]);
  });
});

describe("Unprocessed Tasks", () => {
  it("counts only Open Tasks without When as unprocessed", () => {
    expect(isUnprocessedTask(makeTask())).toBe(true);
    expect(isUnprocessedTask(makeTask({ when: 500 }))).toBe(false);
    expect(isUnprocessedTask(makeTask({ state: "done" }))).toBe(false);
  });
});
