import { describe, expect, it } from "vitest";

import {
  DARK_INK,
  hourOf,
  inkOn,
  isDay,
  LIGHT_INK,
  mix,
  skyAt,
  sunAt,
} from "./sky";

describe("the sky", () => {
  it("lands on a keyframe exactly at its hour", () => {
    expect(skyAt(13)).toEqual({
      top: "rgb(110, 166, 230)",
      horizon: "rgb(220, 235, 248)",
      ink: DARK_INK,
    });
  });

  it("blends between keyframes by the minute", () => {
    // Halfway from 13:00 to 17:00.
    expect(skyAt(15).top).toBe(mix("#6ea6e6", "#7f9fd4", 0.5));
    expect(skyAt(15).top).toBe("rgb(119, 163, 221)");
  });

  it("is the same night sky either side of midnight", () => {
    expect(skyAt(0)).toEqual(skyAt(23.99));
    expect(skyAt(2).top).toBe("rgb(12, 20, 48)");
  });

  it("writes light ink on the night and dusk skies, dark on the day's", () => {
    expect(skyAt(2).ink).toBe(LIGHT_INK);
    expect(skyAt(19).ink).toBe(LIGHT_INK);
    expect(skyAt(10).ink).toBe(DARK_INK);
  });

  it("keeps dawn and dusk rose, never the late amber", () => {
    for (const hour of [6.5, 7, 18, 19, 19.5]) {
      const [r, g, b] = skyAt(hour).horizon.match(/\d+/g)!.map(Number) as [
        number,
        number,
        number,
      ];
      // Amber is red over green over a low blue; rose keeps blue up near green.
      expect(b).toBeGreaterThanOrEqual(g - 10);
      expect(r).toBeGreaterThanOrEqual(g);
    }
  });
});

describe("inkOn", () => {
  it("chooses by luminance", () => {
    expect(inkOn("#ffffff")).toBe(DARK_INK);
    expect(inkOn("#000000")).toBe(LIGHT_INK);
    expect(inkOn("rgb(147, 187, 232)")).toBe(DARK_INK);
    expect(inkOn("rgb(63, 79, 140)")).toBe(LIGHT_INK);
  });
});

describe("the sun", () => {
  it("rises at 6:30, peaks midway and sets at 19:00", () => {
    expect(sunAt(6.5)).toEqual({ x: 0, y: 0 });
    expect(sunAt(12.75)).toEqual({ x: 0.5, y: 1 });
    expect(sunAt(18.99)!.y).toBeCloseTo(0, 2);
  });

  it("is down at night, when the moon is up", () => {
    expect(sunAt(19)).toBeUndefined();
    expect(sunAt(3)).toBeUndefined();
    expect(isDay(6.4)).toBe(false);
    expect(isDay(6.5)).toBe(true);
  });

  it("reads the hour with its minutes", () => {
    expect(hourOf(new Date(2026, 9, 9, 19, 30).getTime())).toBe(19.5);
  });
});
