import { describe, expect, it } from "vitest";

import { daysBetween, headingLabel, spanWords } from "./activity-log-time";

describe("spanWords", () => {
  it.each([
    [1, "1 day"],
    [13, "13 days"],
    [14, "2 weeks"],
    [21, "3 weeks"],
    [24, "3 weeks"],
    [25, "4 weeks"],
    [48, "7 weeks"],
    [49, "2 months"],
    [200, "7 months"],
    [350, "11 months"],
    [351, "1 year"],
    [548, "2 years"],
  ])("reads %i days as %s", (days, words) => {
    expect(spanWords(days)).toBe(words);
  });
});

describe("daysBetween", () => {
  it("counts calendar days, whatever the hours", () => {
    expect(
      daysBetween(
        new Date(2026, 9, 22, 0, 5).getTime(),
        new Date(2026, 9, 1, 23, 55).getTime(),
      ),
    ).toBe(21);
  });
});

describe("headingLabel", () => {
  const today = new Date(2026, 10, 4, 12).getTime();
  const on = (year: number, month: number, date: number) =>
    new Date(year, month, date, 9).getTime();

  it("names today and yesterday by the clock it is given", () => {
    expect(headingLabel(on(2026, 10, 4), on(2026, 10, 4), today)).toBe("Today");
    expect(headingLabel(on(2026, 10, 3), on(2026, 10, 3), today)).toBe(
      "Yesterday",
    );
  });

  it("gives a day its year whenever it isn't this year", () => {
    expect(headingLabel(on(2026, 8, 18), on(2026, 8, 18), today)).toBe(
      "Friday, September 18",
    );
    expect(headingLabel(on(2024, 10, 5), on(2024, 10, 5), today)).toBe(
      "Tuesday, November 5, 2024",
    );
  });

  it("gives a stretch its year whenever it isn't this year, once when it is one year", () => {
    expect(headingLabel(on(2026, 8, 4), on(2026, 9, 4), today)).toBe(
      "Sep 4 – Oct 4",
    );
    expect(headingLabel(on(2025, 5, 1), on(2025, 5, 30), today)).toBe(
      "Jun 1 – Jun 30, 2025",
    );
    expect(headingLabel(on(2025, 11, 20), on(2026, 0, 3), today)).toBe(
      "Dec 20, 2025 – Jan 3",
    );
  });
});
