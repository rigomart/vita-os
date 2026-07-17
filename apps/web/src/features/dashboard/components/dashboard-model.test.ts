import { describe, expect, it } from "vitest";

import {
  followUpDateLabel,
  groupDashboardThreads,
  type DashboardThread,
} from "./dashboard-model";

function thread(
  id: string,
  fields: Partial<DashboardThread> = {},
): DashboardThread {
  return {
    id,
    title: id,
    slug: id,
    areaId: "area",
    order: 0,
    ...fields,
  };
}

describe("groupDashboardThreads", () => {
  const today = new Date(2026, 6, 17, 12).getTime();
  const yesterday = new Date(2026, 6, 16, 18).getTime();
  const older = new Date(2026, 6, 10, 8).getTime();
  const tomorrow = new Date(2026, 6, 18, 8).getTime();

  it("gives Follow-up precedence and uses local-day boundaries", () => {
    const groups = groupDashboardThreads(
      [
        thread("overdue", { followUp: yesterday, nextMove: "Call" }),
        thread("today", { followUp: today }),
        thread("tomorrow", { followUp: tomorrow }),
      ],
      today,
    );

    expect(groups.overdue.map((item) => item.id)).toEqual(["overdue"]);
    expect(groups.upcoming.map((item) => item.id)).toEqual([
      "today",
      "tomorrow",
    ]);
    expect(groups.withNextMoves).toEqual([]);
  });

  it("orders Follow-ups chronologically and classifies undated Threads", () => {
    const groups = groupDashboardThreads(
      [
        thread("newer-overdue", { followUp: yesterday }),
        thread("older-overdue", { followUp: older }),
        thread("next-move", { nextMove: "Send the form" }),
        thread("open"),
      ],
      today,
    );

    expect(groups.overdue.map((item) => item.id)).toEqual([
      "older-overdue",
      "newer-overdue",
    ]);
    expect(groups.withNextMoves.map((item) => item.id)).toEqual(["next-move"]);
    expect(groups.open.map((item) => item.id)).toEqual(["open"]);
  });
});

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
