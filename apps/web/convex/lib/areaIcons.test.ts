import { describe, expect, it } from "vitest";

import { AREA_ICONS, areaIconLabels, DEFAULT_AREA_ICON } from "./areaIcons";

describe("Area Icons", () => {
  it("uses the complete, duplicate-free curated set", () => {
    expect(AREA_ICONS).toEqual([
      "Compass",
      "HeartPulse",
      "Dumbbell",
      "Users",
      "Home",
      "BriefcaseBusiness",
      "WalletCards",
      "BookOpen",
      "Utensils",
      "Car",
      "CalendarDays",
      "Palette",
      "Leaf",
      "Shield",
      "Plane",
    ]);
    expect(new Set(AREA_ICONS).size).toBe(AREA_ICONS.length);
  });

  // The icon an Area gets when nobody has chosen one: what `backfillAreaIcons`
  // stamps on pre-existing Areas, and what the new-Area form opens on.
  it("starts from Compass", () => {
    expect(DEFAULT_AREA_ICON).toBe("Compass");
    expect(AREA_ICONS).toContain(DEFAULT_AREA_ICON);
  });

  it("labels every icon", () => {
    expect(Object.keys(areaIconLabels).sort()).toEqual([...AREA_ICONS].sort());
  });
});
