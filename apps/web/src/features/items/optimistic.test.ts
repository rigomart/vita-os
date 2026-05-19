import type { Doc, Id } from "@convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  completeItemInInbox,
  isUnprocessedItem,
  removeItemFromInbox,
  uncompleteItemInInbox,
  updateItemDateInInbox,
  updateItemTextInInbox,
} from "./optimistic";

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

describe("Task optimistic updates", () => {
  it("keeps Done Tasks in the Inbox after Open Tasks", () => {
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
      completeItemInInbox([completing, open], completing._id, 500),
    ).toEqual([
      open,
      {
        ...completing,
        isCompleted: true,
        completedAt: 500,
      },
    ]);
  });

  it("moves uncompleted Tasks back above Done history", () => {
    const uncompleting = makeTask({
      _id: "uncompleting" as Id<"items">,
      text: "Call clinic",
      isCompleted: true,
      createdAt: 100,
      completedAt: 500,
    });
    const done = makeTask({
      _id: "done" as Id<"items">,
      text: "Buy vitamins",
      isCompleted: true,
      createdAt: 300,
      completedAt: 600,
    });

    expect(
      uncompleteItemInInbox([done, uncompleting], uncompleting._id),
    ).toEqual([
      {
        ...uncompleting,
        isCompleted: false,
        completedAt: undefined,
      },
      done,
    ]);
  });

  it("removes discarded Tasks from the unified Inbox list", () => {
    const keeping = makeTask({ _id: "keeping" as Id<"items"> });
    const removing = makeTask({ _id: "removing" as Id<"items"> });

    expect(removeItemFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("updates a Task's text in the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"items"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"items"> });

    expect(
      updateItemTextInInbox([updating, unchanged], updating._id, "Book labs"),
    ).toEqual([{ ...updating, text: "Book labs" }, unchanged]);
  });

  it("updates or clears a Task's When in the Inbox", () => {
    const updating = makeTask({ _id: "updating" as Id<"items"> });
    const unchanged = makeTask({ _id: "unchanged" as Id<"items"> });

    const withWhen = updateItemDateInInbox(
      [updating, unchanged],
      updating._id,
      1000,
    );

    expect(withWhen).toEqual([{ ...updating, date: 1000 }, unchanged]);
    expect(updateItemDateInInbox(withWhen, updating._id, undefined)).toEqual([
      { ...updating, date: undefined },
      unchanged,
    ]);
  });

  it("counts only Open Tasks without When as unprocessed", () => {
    expect(isUnprocessedItem(makeTask())).toBe(true);
    expect(isUnprocessedItem(makeTask({ date: 500 }))).toBe(false);
    expect(isUnprocessedItem(makeTask({ isCompleted: true }))).toBe(false);
  });
});
