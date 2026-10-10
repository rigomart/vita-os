import { describe, expect, it } from "vitest";

import { nearestSnapPoint, positionAt } from "./snap-points";

const box = { width: 200, height: 40 };
const viewport = { width: 1000, height: 800 };

describe("snap points", () => {
  it("rests each point inside the viewport's margin", () => {
    expect(positionAt("top-left", box, viewport)).toEqual({
      left: 16,
      top: 16,
    });
    expect(positionAt("top-center", box, viewport)).toEqual({
      left: 400,
      top: 16,
    });
    expect(positionAt("bottom-right", box, viewport)).toEqual({
      left: 784,
      top: 744,
    });
  });

  it("snaps a drop to the closest point", () => {
    expect(nearestSnapPoint({ left: 30, top: 50 }, box, viewport)).toBe(
      "top-left",
    );
    expect(nearestSnapPoint({ left: 450, top: 600 }, box, viewport)).toBe(
      "bottom-center",
    );
    expect(nearestSnapPoint({ left: 700, top: 120 }, box, viewport)).toBe(
      "top-right",
    );
  });
});
