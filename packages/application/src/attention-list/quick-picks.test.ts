import { describe, expect, it } from "vitest";

import { onDay, quickPicks, timeSuggestions } from "./quick-picks";

const day = (month: number, date: number) =>
  new Date(2026, month - 1, date).getTime();

describe("quickPicks", () => {
  it("lands each pick on its day, from a weekday", () => {
    // Thursday, Aug 13, mid-afternoon.
    const now = new Date(2026, 7, 13, 15, 20).getTime();
    expect(quickPicks(now)).toEqual([
      { label: "Today", day: day(8, 13) },
      { label: "Tomorrow", day: day(8, 14) },
      { label: "This weekend", day: day(8, 15) },
      { label: "Next week", day: day(8, 17) },
      { label: "In 2 weeks", day: day(8, 27) },
      { label: "In a month", day: day(9, 13) },
    ]);
  });

  it("leaves out this weekend on a Saturday, which is today", () => {
    const picks = quickPicks(new Date(2026, 7, 15, 10).getTime());
    expect(picks.map((pick) => pick.label)).toEqual([
      "Today",
      "Tomorrow",
      "Next week",
      "In 2 weeks",
      "In a month",
    ]);
  });

  it("calls it next weekend on a Sunday, and leaves out next week, which is tomorrow", () => {
    const picks = quickPicks(new Date(2026, 7, 16, 10).getTime());
    expect(picks.map((pick) => pick.label)).toEqual([
      "Today",
      "Tomorrow",
      "Next weekend",
      "In 2 weeks",
      "In a month",
    ]);
    expect(picks[2]!.day).toBe(day(8, 22));
  });

  it("ends a month's last day on the next month's last", () => {
    const picks = quickPicks(new Date(2026, 0, 31).getTime());
    expect(picks.at(-1)).toEqual({ label: "In a month", day: day(2, 28) });
  });
});

describe("onDay", () => {
  it("keeps the time the When carries, and none when it has none", () => {
    const at = new Date(2026, 7, 13, 9, 30).getTime();
    expect(onDay(day(8, 20), at)).toBe(new Date(2026, 7, 20, 9, 30).getTime());
    expect(onDay(day(8, 20), day(8, 13))).toBe(day(8, 20));
    expect(onDay(day(8, 20), undefined)).toBe(day(8, 20));
  });
});

describe("timeSuggestions", () => {
  it.each([
    ["7", ["07:00", "19:00"]],
    ["3", ["15:00", "03:00"]],
    ["7:3", ["07:30", "19:30"]],
    ["745", ["07:45", "19:45"]],
    ["745p", ["19:45"]],
    ["8:30 am", ["08:30"]],
    ["1930", ["19:30"]],
    ["19", ["19:00"]],
    ["12", ["12:00"]],
    ["noon", ["12:00"]],
  ])("reads %s as %j", (text, times) => {
    expect(timeSuggestions(text)).toEqual(times);
  });

  it.each(["", "x", "24", "7:75", "13pm", "12345"])(
    "offers nothing for %j",
    (text) => {
      expect(timeSuggestions(text)).toEqual([]);
    },
  );

  it("never offers midnight, which reads as a day alone", () => {
    expect(timeSuggestions("12am")).toEqual([]);
    expect(timeSuggestions("0")).toEqual([]);
    expect(timeSuggestions("0:30")).toEqual(["00:30"]);
  });
});
