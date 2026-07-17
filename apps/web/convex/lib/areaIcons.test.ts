import { describe, expect, it } from "vitest";

import {
  AREA_ICONS,
  DEFAULT_AREA_ICON,
  getAreaIcon,
  isAreaIcon,
} from "./areaIcons";

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

  it("defaults missing and unknown values to Compass", () => {
    expect(DEFAULT_AREA_ICON).toBe("Compass");
    expect(getAreaIcon()).toBe("Compass");
    expect(getAreaIcon("Unknown")).toBe("Compass");
  });

  it("recognizes only allowed icon values", () => {
    expect(isAreaIcon("HeartPulse")).toBe(true);
    expect(isAreaIcon("Unknown")).toBe(false);
    expect(isAreaIcon(undefined)).toBe(false);
  });
});
