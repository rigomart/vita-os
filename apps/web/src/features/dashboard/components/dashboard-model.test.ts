import { describe, expect, it } from "vitest";

import {
  dayDelta,
  daysSince,
  followUpDateLabel,
  relativeDayLabel,
} from "./dashboard-model";

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

describe("Dashboard date annotations", () => {
  const today = new Date(2026, 6, 17, 12).getTime();
  const at = (offset: number) => new Date(2026, 6, 17 + offset, 9).getTime();

  it("measures local calendar days in either direction", () => {
    expect(dayDelta(at(-3), today)).toBe(-3);
    expect(dayDelta(at(4), today)).toBe(4);
    expect(daysSince(at(-45), today)).toBe(45);
    expect(daysSince(at(2), today)).toBe(0);
  });

  it("keeps soft dates compact and relative near today", () => {
    expect(relativeDayLabel(at(-3), today)).toBe("3d late");
    expect(relativeDayLabel(at(-1), today)).toBe("Yesterday");
    expect(relativeDayLabel(at(0), today)).toBe("Today");
    expect(relativeDayLabel(at(1), today)).toBe("Tomorrow");
    expect(relativeDayLabel(at(3), today)).toBe("Mon");
    expect(relativeDayLabel(at(10), today)).toBe("Jul 27");
  });
});
