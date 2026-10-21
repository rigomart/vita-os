import { describe, expect, it } from "vitest";

import { onDay } from "./date-parts";

const day = (month: number, date: number) =>
  new Date(2026, month - 1, date).getTime();

describe("onDay", () => {
  it("keeps the time the When carries, and none when it has none", () => {
    const at = new Date(2026, 7, 13, 9, 30).getTime();
    expect(onDay(day(8, 20), at)).toBe(new Date(2026, 7, 20, 9, 30).getTime());
    expect(onDay(day(8, 20), day(8, 13))).toBe(day(8, 20));
    expect(onDay(day(8, 20), undefined)).toBe(day(8, 20));
  });
});
