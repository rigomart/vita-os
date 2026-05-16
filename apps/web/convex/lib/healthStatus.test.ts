import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEALTH_STATUS,
  HEALTH_STATUS_OPTIONS,
  HEALTH_STATUSES,
  healthColors,
  healthLabels,
  isHealthStatus,
} from "./healthStatus";

describe("Health status", () => {
  it("defines the manual Area Health status vocabulary", () => {
    expect(HEALTH_STATUSES).toEqual(["healthy", "needs_attention", "critical"]);
  });

  it("uses healthy as the default Health status", () => {
    expect(DEFAULT_HEALTH_STATUS).toBe("healthy");
  });

  it("has display metadata for every Health status", () => {
    expect(HEALTH_STATUS_OPTIONS).toEqual([
      {
        value: "healthy",
        label: "Healthy",
        color: "bg-green-500",
      },
      {
        value: "needs_attention",
        label: "Needs attention",
        color: "bg-yellow-500",
      },
      {
        value: "critical",
        label: "Critical",
        color: "bg-red-500",
      },
    ]);

    for (const status of HEALTH_STATUSES) {
      expect(healthLabels[status]).toBeTruthy();
      expect(healthColors[status]).toMatch(/^bg-/);
    }
  });

  it("recognizes valid Health status values", () => {
    expect(isHealthStatus("healthy")).toBe(true);
    expect(isHealthStatus("needs_attention")).toBe(true);
    expect(isHealthStatus("critical")).toBe(true);
  });

  it("rejects non-Health status values", () => {
    expect(isHealthStatus("no_next_action")).toBe(false);
    expect(isHealthStatus("active")).toBe(false);
    expect(isHealthStatus(null)).toBe(false);
  });
});
