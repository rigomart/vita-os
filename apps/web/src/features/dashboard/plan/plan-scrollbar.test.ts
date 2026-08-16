import { describe, expect, it } from "vitest";

import { scrollbarGeometry } from "./plan-scrollbar";

const HEADER = 178;
const BAY = 120;

describe("scrollbarGeometry", () => {
  it("stays away when the canvas fits", () => {
    expect(
      scrollbarGeometry(
        { clientWidth: 1000, scrollLeft: 0, scrollWidth: 1000 },
        HEADER,
        BAY,
      ),
    ).toBeNull();
  });

  it("sizes the thumb against the day region, not the whole viewport", () => {
    const geometry = scrollbarGeometry(
      { clientWidth: 1000, scrollLeft: 0, scrollWidth: 2000 },
      HEADER,
      BAY,
    );

    // 702 of 1702 scrollable pixels are on screen — measuring against the full
    // viewport would have claimed half.
    expect(geometry?.size).toBeCloseTo(702 / 1702, 5);
    expect(geometry?.progress).toBe(0);
  });

  it("reads the thumb all the way to the end at full scroll", () => {
    const geometry = scrollbarGeometry(
      { clientWidth: 1000, scrollLeft: 1000, scrollWidth: 2000 },
      HEADER,
      BAY,
    );

    expect(geometry?.progress).toBe(1);
  });

  it("clamps overscroll to the track", () => {
    const bounced = scrollbarGeometry(
      { clientWidth: 1000, scrollLeft: 1200, scrollWidth: 2000 },
      HEADER,
      BAY,
    );
    expect(bounced?.progress).toBe(1);

    const rubberBanded = scrollbarGeometry(
      { clientWidth: 1000, scrollLeft: -40, scrollWidth: 2000 },
      HEADER,
      BAY,
    );
    expect(rubberBanded?.progress).toBe(0);
  });

  it("fills the track when the pinned columns swallow the viewport", () => {
    const geometry = scrollbarGeometry(
      { clientWidth: 280, scrollLeft: 0, scrollWidth: 290 },
      HEADER,
      BAY,
    );

    expect(geometry?.size).toBe(1);
  });
});
