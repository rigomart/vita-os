import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";

import { getAreaDeletionBlocker } from "./areaThreads";

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
