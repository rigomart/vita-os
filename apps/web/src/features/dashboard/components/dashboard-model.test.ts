import { describe, expect, it } from "vitest";

import type { DashboardThread } from "./dashboard-model";

import { followUpDateLabel, recentActivity } from "./dashboard-model";

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

describe("recentActivity", () => {
  function thread(
    id: string,
    fields: Partial<DashboardThread> = {},
  ): DashboardThread {
    return { id, title: id, slug: id, areaId: "area", order: 0, ...fields };
  }

  it("returns Threads with activity only, newest first", () => {
    const entries = recentActivity([
      thread("quiet"),
      thread("old", { lastActivityAt: 10, lastActivityContent: "old note" }),
      thread("new", { lastActivityAt: 40, lastActivityContent: "new note" }),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(["new", "old"]);
  });

  it("caps the strip at six Threads", () => {
    const threads = Array.from({ length: 8 }, (_, index) =>
      thread(`t${index}`, {
        lastActivityAt: index,
        lastActivityContent: "note",
      }),
    );

    const entries = recentActivity(threads);

    expect(entries).toHaveLength(6);
    expect(entries[0]?.id).toBe("t7");
  });

  it("returns nothing when no Thread has activity", () => {
    expect(recentActivity([thread("a"), thread("b")])).toEqual([]);
  });
});
