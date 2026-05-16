import type { Doc, Id } from "@convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  completeItemInInbox,
  isUnprocessedItem,
  removeItemFromInbox,
  uncompleteItemInInbox,
} from "./optimistic";

function makeItem(overrides: Partial<Doc<"items">> = {}): Doc<"items"> {
  return {
    _id: "item1" as Id<"items">,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    isCompleted: false,
    createdAt: 0,
    ...overrides,
  };
}

describe("Item optimistic updates", () => {
  it("keeps completed Items in the Inbox after active Items", () => {
    const active = makeItem({
      _id: "active" as Id<"items">,
      text: "Buy vitamins",
      createdAt: 200,
    });
    const completing = makeItem({
      _id: "completing" as Id<"items">,
      text: "Call clinic",
      createdAt: 300,
    });

    expect(
      completeItemInInbox([completing, active], completing._id, 500),
    ).toEqual([
      active,
      {
        ...completing,
        isCompleted: true,
        completedAt: 500,
      },
    ]);
  });

  it("moves uncompleted Items back above completed Items", () => {
    const uncompleting = makeItem({
      _id: "uncompleting" as Id<"items">,
      text: "Call clinic",
      isCompleted: true,
      createdAt: 100,
      completedAt: 500,
    });
    const completed = makeItem({
      _id: "completed" as Id<"items">,
      text: "Buy vitamins",
      isCompleted: true,
      createdAt: 300,
      completedAt: 600,
    });

    expect(
      uncompleteItemInInbox([completed, uncompleting], uncompleting._id),
    ).toEqual([
      {
        ...uncompleting,
        isCompleted: false,
        completedAt: undefined,
      },
      completed,
    ]);
  });

  it("removes discarded Items from the unified Inbox list", () => {
    const keeping = makeItem({ _id: "keeping" as Id<"items"> });
    const removing = makeItem({ _id: "removing" as Id<"items"> });

    expect(removeItemFromInbox([removing, keeping], removing._id)).toEqual([
      keeping,
    ]);
  });

  it("counts only Items that are neither completed nor dated as unprocessed", () => {
    expect(isUnprocessedItem(makeItem())).toBe(true);
    expect(isUnprocessedItem(makeItem({ date: 500 }))).toBe(false);
    expect(isUnprocessedItem(makeItem({ isCompleted: true }))).toBe(false);
  });
});
