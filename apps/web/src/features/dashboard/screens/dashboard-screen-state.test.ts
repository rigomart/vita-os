import { describe, expect, it } from "vitest";
import { shouldShowAreaSetup } from "./dashboard-screen-state";

describe("shouldShowAreaSetup", () => {
  it("keeps Area setup only for a first-run empty Dashboard", () => {
    expect(shouldShowAreaSetup({ areaCount: 0, attentionThreadCount: 0 })).toBe(
      true,
    );
    expect(shouldShowAreaSetup({ areaCount: 1, attentionThreadCount: 0 })).toBe(
      false,
    );
    expect(shouldShowAreaSetup({ areaCount: 0, attentionThreadCount: 1 })).toBe(
      false,
    );
  });
});
