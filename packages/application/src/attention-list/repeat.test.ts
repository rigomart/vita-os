import { describe, expect, it } from "vitest";

import {
  ordinal,
  repeatLabel,
  repeatPresets,
  repeatShortLabel,
  repeatSummary,
} from "./repeat";

describe("monthly Repeat in the picker", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [30, "30th"],
    [31, "31st"],
  ])("says day %i as %s", (day, said) => {
    expect(ordinal(day)).toBe(said);
  });

  it("offers every month on the date's own day, beside the other presets", () => {
    // Sunday, Jan 31.
    const presets = repeatPresets(
      new Date(2027, 0, 31, 9).getTime(),
      undefined,
    );
    expect(presets.map((preset) => preset.label)).toEqual([
      "Every day",
      "Every weekday",
      "Every Sunday",
      "Every 2 weeks",
      "Every month on the 31st",
    ]);
    expect(presets.at(-1)?.repeat).toEqual({ kind: "monthly", day: 31 });
  });

  it("keeps a monthly Task's own day where a short month stands in for it", () => {
    const presets = repeatPresets(new Date(2027, 1, 28, 9).getTime(), {
      kind: "monthly",
      day: 31,
    });
    expect(presets.at(-1)).toEqual({
      label: "Every month on the 31st",
      word: "Monthly",
      repeat: { kind: "monthly", day: 31 },
    });
  });

  it("labels the glyph and the Repeat row", () => {
    expect(repeatLabel({ kind: "monthly", day: 2 })).toBe(
      "Repeats monthly on the 2nd",
    );
    expect(repeatShortLabel({ kind: "monthly", day: 22 })).toBe(
      "Monthly on the 22nd",
    );
  });
});

describe("the Repeat's summary line", () => {
  it("names neither a Task nor a Note, so it fits both", () => {
    expect(repeatSummary(undefined, { mode: "daily" }, "UTC")).toBe(
      "No date. A repeat needs a date.",
    );
  });
});
