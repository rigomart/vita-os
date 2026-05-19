import type { Doc, Id } from "@convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  completeTaskInInbox,
  isTaskWhenDue,
  isTaskWhenEmphasized,
  isUnprocessedTask,
  removeTaskFromInbox,
  sortInboxTasks,
  uncompleteTaskInInbox,
  updateTaskWhenInInbox,
} from "./inbox";

function makeTask(overrides: Partial<Doc<"items">> = {}): Doc<"items"> {
  return {
    _id: "task1" as Id<"items">,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    isCompleted: false,
    createdAt: 0,
    ...overrides,
  };
}

const may18_2026 = new Date(2026, 4, 18, 12).getTime();
const may19_2026 = new Date(2026, 4, 19, 12).getTime();
const may17_2026 = new Date(2026, 4, 17, 12).getTime();

describe("Task inbox ordering", () => {
  it("lists Open Tasks before Done Tasks", () => {
    const open = makeTask({
      _id: "open" as Id<"items">,
      text: "Buy vitamins",
      createdAt: 200,
    });
    const done = makeTask({
      _id: "done" as Id<"items">,
      text: "Call clinic",
      isCompleted: true,
      completedAt: 500,
      createdAt: 300,
    });

    expect(sortInboxTasks([done, open])).toEqual([open, done]);
  });
});

describe("Task When emphasis", () => {
  it("treats When on or before today as due", () => {
    expect(isTaskWhenDue(may18_2026, may18_2026)).toBe(true);
    expect(isTaskWhenDue(may17_2026, may18_2026)).toBe(true);
    expect(isTaskWhenDue(may19_2026, may18_2026)).toBe(false);
    expect(isTaskWhenDue(undefined, may18_2026)).toBe(false);
  });

  it("emphasizes Open Tasks with due When", () => {
    expect(
      isTaskWhenEmphasized(makeTask({ date: may17_2026 }), may18_2026),
    ).toBe(true);
    expect(
      isTaskWhenEmphasized(makeTask({ date: may19_2026 }), may18_2026),
    ).toBe(false);
    expect(
      isTaskWhenEmphasized(
        makeTask({ date: may17_2026, isCompleted: true }),
        may18_2026,
      ),
    ).toBe(false);
  });
});

describe("Task inbox mutations", () => {
  it("moves completed Tasks into Done history after Open Tasks", () => {
    const open = makeTask({
      _id: "open" as Id<"items">,
      text: "Buy vitamins",
      createdAt: 200,
    });
    const completing = makeTask({
      _id: "completing" as Id<"items">,
      text: "Call clinic",
      createdAt: 300,
    });

    expect(
      completeTaskInInbox([completing, open], completing._id, 500),
    ).toEqual([
      open,
      {
        ...completing,
        isCompleted: true,
        completedAt: 500,
      },
    ]);
  });

  it("restores uncompleted Tasks above Done history", () => {
    const uncompleting = makeTask({
      _id: "uncompleting" as Id<"items">,
      isCompleted: true,
      completedAt: 500,
      createdAt: 100,
    });
    const done = makeTask({
      _id: "done" as Id<"items">,
      isCompleted: true,
      completedAt: 600,
      createdAt: 300,
    });

    expect(
      uncompleteTaskInInbox([done, uncompleting], uncompleting._id),
    ).toEqual([
      {
        ...uncompleting,
        isCompleted: false,
        completedAt: undefined,
      },
      done,
    ]);
  });

  it("removes discarded Tasks from the visible Inbox list", () => {
    const keeping = makeTask({ _id: "keeping" as Id<"items"> });
    const removing = makeTask({ _id: "removing" as Id<"items"> });

    expect(removeTaskFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("updates or clears Task When without removing the Task from the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"items"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"items"> });

    const withWhen = updateTaskWhenInInbox(
      [updating, unchanged],
      updating._id,
      may19_2026,
    );

    expect(withWhen).toEqual([{ ...updating, date: may19_2026 }, unchanged]);
    expect(updateTaskWhenInInbox(withWhen, updating._id, undefined)).toEqual([
      { ...updating, date: undefined },
      unchanged,
    ]);
  });
});

describe("Unprocessed Tasks", () => {
  it("counts only Open Tasks without When as unprocessed", () => {
    expect(isUnprocessedTask(makeTask())).toBe(true);
    expect(isUnprocessedTask(makeTask({ date: 500 }))).toBe(false);
    expect(isUnprocessedTask(makeTask({ isCompleted: true }))).toBe(false);
  });
});
