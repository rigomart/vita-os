import { describe, expect, it } from "vitest";

import { fitFilterChips } from "./dashboard-filter-fit";

// All, four Areas and No area, each 60 wide; More takes 40.
const widths = [60, 60, 60, 60, 60, 60];
const moreWidth = 40;

describe("fitFilterChips", () => {
  it("shows every chip when they all fit, with no room kept for More", () => {
    expect(
      fitFilterChips({ widths, room: 360, moreWidth, selected: 0 }),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("folds what does not fit beside More, in order", () => {
    // 300 room, 260 once More is kept: four chips.
    expect(
      fitFilterChips({ widths, room: 300, moreWidth, selected: 0 }),
    ).toEqual([0, 1, 2, 3]);
  });

  it("keeps a selected chip that already fits where it is", () => {
    expect(
      fitFilterChips({ widths, room: 300, moreWidth, selected: 2 }),
    ).toEqual([0, 1, 2, 3]);
  });

  it("gives a folded selection the last place", () => {
    expect(
      fitFilterChips({ widths, room: 300, moreWidth, selected: 5 }),
    ).toEqual([0, 1, 2, 5]);
  });

  it("gives up as many places as a wide folded selection needs", () => {
    expect(
      fitFilterChips({
        widths: [60, 60, 60, 60, 60, 150],
        room: 300,
        moreWidth,
        selected: 5,
      }),
    ).toEqual([0, 5]);
  });

  it("shows at least one chip however narrow the row", () => {
    expect(
      fitFilterChips({ widths, room: 20, moreWidth, selected: 0 }),
    ).toEqual([0]);
    expect(
      fitFilterChips({ widths, room: 20, moreWidth, selected: -1 }),
    ).toEqual([0]);
  });

  it("shows the selection alone when nothing else fits beside it", () => {
    expect(
      fitFilterChips({ widths, room: 90, moreWidth, selected: 4 }),
    ).toEqual([4]);
  });

  it("folds by the first chips when the selection is elsewhere", () => {
    // Notes is selected: it is not one of these chips.
    expect(
      fitFilterChips({ widths, room: 200, moreWidth, selected: -1 }),
    ).toEqual([0, 1]);
  });
});
