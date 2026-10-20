import { describe, expect, it } from "vitest";

import { cursorMove, nextFocusKey, stepIndex } from "./dashboard-cursor-model";

const key = (
  k: string,
  extra: Partial<Parameters<typeof cursorMove>[0]> = {},
) =>
  cursorMove({
    altKey: false,
    ctrlKey: false,
    key: k,
    metaKey: false,
    shiftKey: false,
    ...extra,
  });

describe("cursorMove", () => {
  it("steps with the arrows and j/k, and jumps with Home and End", () => {
    expect(key("ArrowDown")).toBe("next");
    expect(key("j")).toBe("next");
    expect(key("ArrowUp")).toBe("previous");
    expect(key("k")).toBe("previous");
    expect(key("Home")).toBe("first");
    expect(key("End")).toBe("last");
  });

  it("leaves other keys and chords alone", () => {
    expect(key("Enter")).toBeUndefined();
    expect(key("q")).toBeUndefined();
    expect(key("1")).toBeUndefined();
    expect(key("k", { metaKey: true })).toBeUndefined();
    expect(key("ArrowDown", { altKey: true })).toBeUndefined();
    expect(key("J", { shiftKey: true })).toBeUndefined();
  });
});

describe("stepIndex", () => {
  it("moves one item at a time and holds at the ends", () => {
    expect(stepIndex(3, 0, "next")).toBe(1);
    expect(stepIndex(3, 2, "next")).toBe(2);
    expect(stepIndex(3, 0, "previous")).toBe(0);
    expect(stepIndex(3, 1, "first")).toBe(0);
    expect(stepIndex(3, 0, "last")).toBe(2);
    expect(stepIndex(0, 0, "next")).toBeUndefined();
  });
});

describe("nextFocusKey", () => {
  it("keeps focus on an item still in its place", () => {
    expect(nextFocusKey(["a", "b", "c"], "b", ["a", "b", "c"])).toBe("b");
    expect(nextFocusKey(["a", "b", "c"], "b", ["x", "a", "b", "c"])).toBe("b");
  });

  it("moves to the next item when the focused one leaves", () => {
    expect(nextFocusKey(["a", "b", "c"], "b", ["a", "c"])).toBe("c");
  });

  it("stays at the old place when the item moves further down", () => {
    expect(nextFocusKey(["a", "b", "c", "d"], "b", ["a", "c", "d", "b"])).toBe(
      "c",
    );
  });

  it("stays at the old place when the last item moves up", () => {
    expect(nextFocusKey(["a", "b", "c"], "c", ["c", "a", "b"])).toBe("b");
  });

  it("skips neighbours that left with it", () => {
    expect(nextFocusKey(["a", "b", "c", "d"], "b", ["a", "d"])).toBe("d");
  });

  it("falls back to the previous item at the end of the list", () => {
    expect(nextFocusKey(["a", "b", "c"], "c", ["a", "b"])).toBe("b");
  });

  it("falls back to the first item when none of its neighbours remain", () => {
    expect(nextFocusKey(["a"], "a", ["x", "y"])).toBe("x");
  });

  it("has nothing to focus on an empty list", () => {
    expect(nextFocusKey(["a"], "a", [])).toBeUndefined();
  });
});
