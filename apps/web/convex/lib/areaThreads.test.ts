import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";

import { areaBelongsToUser, getAreaDeletionBlocker } from "./areaThreads";
import { DEFAULT_CONDITION } from "./condition";

function makeArea(overrides: Partial<Doc<"areas">> = {}): Doc<"areas"> {
  return {
    _id: "area1" as Id<"areas">,
    _creationTime: 0,
    userId: "user1",
    name: "Family Health",
    slug: "family-health-00000000",
    condition: DEFAULT_CONDITION,
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

function makeThread(overrides: Partial<Doc<"threads">> = {}): Doc<"threads"> {
  return {
    _id: "thread1" as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title: "Book checkup",
    slug: "book-checkup-00000000",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

describe("areaBelongsToUser", () => {
  it("accepts an Area owned by the user", () => {
    expect(areaBelongsToUser(makeArea(), "user1")).toBe(true);
  });

  it("rejects missing Areas", () => {
    expect(areaBelongsToUser(null, "user1")).toBe(false);
  });

  it("rejects Areas owned by another user", () => {
    expect(areaBelongsToUser(makeArea({ userId: "user2" }), "user1")).toBe(
      false,
    );
  });
});

describe("getAreaDeletionBlocker", () => {
  it("allows deleting Areas with no Threads", () => {
    expect(getAreaDeletionBlocker([])).toBeNull();
  });

  it.each(["open", "resolved"] as const)(
    "blocks deleting an Area with a %s Thread",
    (state) => {
      const thread = makeThread({ state });

      expect(getAreaDeletionBlocker([thread])).toBe(thread);
    },
  );
});
