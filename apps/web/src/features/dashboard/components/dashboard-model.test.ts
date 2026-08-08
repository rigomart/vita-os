import { describe, expect, it } from "vitest";

import { followUpDateLabel } from "./dashboard-model";

describe("followUpDateLabel", () => {
  const today = new Date(2026, 6, 17, 12).getTime();

  it("uses exact dashboard labels", () => {
    expect(followUpDateLabel(today, today)).toBe("Today");
    expect(followUpDateLabel(new Date(2026, 6, 18, 12).getTime(), today)).toBe(
      "Tomorrow",
    );
    expect(followUpDateLabel(new Date(2026, 6, 20, 12).getTime(), today)).toBe(
      "Jul 20",
    );
  });
});
