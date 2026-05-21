import type { Doc, Id } from "@convex/_generated/dataModel";

import { describe, expect, it } from "vitest";

import {
  completeTaskInInbox,
  isUnprocessedTask,
  removeTaskFromInbox,
  uncompleteTaskInInbox,
  updateTaskTextInInbox,
  updateTaskWhenInInbox,
} from "./optimistic";

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

describe("Task optimistic updates", () => {
  it("keeps Done Tasks in the Inbox after Open Tasks", () => {
    const open = makeTask({
      _id: "open" as Id<"tasks">,
      text: "Buy vitamins",
      createdAt: 200,
    });
    const completing = makeTask({
      _id: "completing" as Id<"tasks">,
      text: "Call clinic",
      createdAt: 300,
    });

    expect(
      completeTaskInInbox([completing, open], completing._id, 500),
    ).toEqual([
      open,
      {
        ...completing,
        state: "done",
        completedAt: 500,
      },
    ]);
  });

  it("moves uncompleted Tasks back above Done history", () => {
    const uncompleting = makeTask({
      _id: "uncompleting" as Id<"tasks">,
      text: "Call clinic",
      state: "done",
      createdAt: 100,
      completedAt: 500,
    });
    const done = makeTask({
      _id: "done" as Id<"tasks">,
      text: "Buy vitamins",
      state: "done",
      createdAt: 300,
      completedAt: 600,
    });

    expect(
      uncompleteTaskInInbox([done, uncompleting], uncompleting._id),
    ).toEqual([
      {
        ...uncompleting,
        state: "open",
        completedAt: undefined,
      },
      done,
    ]);
  });

  it("removes discarded Tasks from the unified Inbox list", () => {
    const keeping = makeTask({ _id: "keeping" as Id<"tasks"> });
    const removing = makeTask({ _id: "removing" as Id<"tasks"> });

    expect(removeTaskFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("updates a Task's text in the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"tasks"> });

    expect(
      updateTaskTextInInbox([updating, unchanged], updating._id, "Book labs"),
    ).toEqual([{ ...updating, text: "Book labs" }, unchanged]);
  });

  it("updates or clears a Task's When in the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"tasks"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"tasks"> });

    const withWhen = updateTaskWhenInInbox(
      [updating, unchanged],
      updating._id,
      1000,
    );

    expect(withWhen).toEqual([{ ...updating, when: 1000 }, unchanged]);
    expect(updateTaskWhenInInbox(withWhen, updating._id, undefined)).toEqual([
      { ...updating, when: undefined },
      unchanged,
    ]);
  });

  it("counts only Open Tasks without When as unprocessed", () => {
    expect(isUnprocessedTask(makeTask())).toBe(true);
    expect(isUnprocessedTask(makeTask({ when: 500 }))).toBe(false);
    expect(isUnprocessedTask(makeTask({ state: "done" }))).toBe(false);
  });
});
