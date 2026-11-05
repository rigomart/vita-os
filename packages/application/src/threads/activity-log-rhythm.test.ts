import type { ActivityLogEntry, ActivityLogEntryId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { describeRhythm, readRhythm } from "./activity-log-rhythm";

const today = new Date(2026, 10, 4, 12).getTime();

function completions(...moments: Date[]): ActivityLogEntry[] {
  return moments.map((at, index) => ({
    _id: `c${index}` as ActivityLogEntryId,
    type: "move_completed",
    content: 'Completed "Evening tablet"',
    previousValue: "Evening tablet",
    createdAt: at.getTime(),
  }));
}

function daily(
  month: number,
  first: number,
  last: number,
  [hour, minute]: [number, number],
  skip: number[] = [],
) {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
    .filter((date) => !skip.includes(date))
    .map((date) => new Date(2026, month, date, hour, minute));
}

describe("a stretch's rhythm", () => {
  it("reads a daily rhythm with its usual time and the day with none", () => {
    const rhythm = readRhythm(completions(...daily(8, 4, 30, [20, 10], [21])));

    expect(rhythm.step).toBe(1);
    expect(rhythm.quiet).toEqual([new Date(2026, 8, 21).getTime()]);
    expect(describeRhythm(rhythm, today)).toBe(
      "Every day around 8:10 PM · none on Mon, Sep 21",
    );
  });

  it("names the weekday of a weekly rhythm", () => {
    const saturdays = [5, 12, 19, 26].map(
      (date) => new Date(2026, 8, date, 11, date === 12 ? 40 : 30),
    );

    expect(describeRhythm(readRhythm(completions(...saturdays)), today)).toBe(
      "Every week, on Saturdays around 11:30 AM",
    );
  });

  it("counts many days with none rather than naming them", () => {
    const rhythm = readRhythm(
      completions(...daily(9, 1, 20, [8, 0], [3, 7, 11])),
    );

    expect(describeRhythm(rhythm, today)).toBe(
      "Every day around 8:00 AM · none on 3 days",
    );
  });

  it("gives the year of a day with none when it isn't this year", () => {
    const rhythm = readRhythm(
      completions(
        new Date(2025, 2, 1, 9),
        new Date(2025, 2, 2, 9),
        new Date(2025, 2, 4, 9),
        new Date(2025, 2, 5, 9),
      ),
    );

    expect(describeRhythm(rhythm, today)).toBe(
      "Every day around 9:00 AM · none on Mon, Mar 3, 2025",
    );
  });

  it("says only how many days an irregular stretch covers, and no time when they spread", () => {
    const rhythm = readRhythm(
      completions(
        new Date(2026, 9, 1, 8),
        new Date(2026, 9, 3, 13),
        new Date(2026, 9, 10, 21),
        new Date(2026, 9, 11, 7),
      ),
    );

    expect(rhythm.step).toBeUndefined();
    expect(rhythm.quiet).toEqual([]);
    expect(describeRhythm(rhythm, today)).toBe("On 4 days");
  });

  it("names no rhythm from one gap between days", () => {
    expect(
      describeRhythm(
        readRhythm(
          completions(new Date(2026, 0, 1, 9), new Date(2026, 6, 1, 9)),
        ),
        today,
      ),
    ).toBe("On 2 days around 9:00 AM");
    expect(
      describeRhythm(
        readRhythm(
          completions(
            new Date(2026, 0, 1, 9),
            new Date(2026, 0, 2, 9),
            new Date(2026, 1, 1, 9),
          ),
        ),
        today,
      ),
    ).toBe("On 3 days around 9:00 AM");
  });

  it("names the date a month went without one", () => {
    const rhythm = readRhythm(
      completions(
        ...[0, 1, 3, 4, 5].map((month) => new Date(2026, month, 1, 9)),
      ),
    );

    expect(rhythm.quiet).toEqual([new Date(2026, 2, 1).getTime()]);
    expect(describeRhythm(rhythm, today)).toBe(
      "Every month around 9:00 AM · none on Sun, Mar 1",
    );
  });

  it("tells nothing for a stretch within one day", () => {
    const rhythm = readRhythm(
      completions(new Date(2026, 9, 1, 8), new Date(2026, 9, 1, 9)),
    );

    expect(rhythm.days).toHaveLength(1);
    expect(describeRhythm(rhythm, today)).toBeUndefined();
  });
});
