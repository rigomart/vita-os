import { describe, expect, it } from "vitest";

import {
  CONDITION_OPTIONS,
  CONDITIONS,
  conditionLabels,
  DEFAULT_CONDITION,
  isCondition,
} from "./condition";

describe("Area Condition", () => {
  it("defines the manual Condition vocabulary", () => {
    expect(CONDITIONS).toEqual(["healthy", "needs_attention", "critical"]);
  });

  it("uses healthy as the default Condition", () => {
    expect(DEFAULT_CONDITION).toBe("healthy");
  });

  it("has display metadata for every Condition", () => {
    expect(CONDITION_OPTIONS).toEqual([
      { value: "healthy", label: "Healthy" },
      { value: "needs_attention", label: "Needs attention" },
      { value: "critical", label: "Critical" },
    ]);

    for (const condition of CONDITIONS) {
      expect(conditionLabels[condition]).toBeTruthy();
    }
  });

  it("recognizes valid Condition values", () => {
    expect(isCondition("healthy")).toBe(true);
    expect(isCondition("needs_attention")).toBe(true);
    expect(isCondition("critical")).toBe(true);
  });

  it("rejects values that are not manual Conditions", () => {
    expect(isCondition("no_next_action")).toBe(false);
    expect(isCondition("stale")).toBe(false);
    expect(isCondition("overdue")).toBe(false);
    expect(isCondition("active")).toBe(false);
    expect(isCondition(null)).toBe(false);
  });
});
