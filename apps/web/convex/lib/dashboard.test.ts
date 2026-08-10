import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";

import { buildDashboardOverview } from "./dashboard";

function area(id: string, overrides: Partial<Doc<"areas">> = {}): Doc<"areas"> {
  return {
    _id: id as Id<"areas">,
    _creationTime: 0,
    userId: "user1",
    name: id,
    slug: id,
    condition: "healthy",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

function thread(
  id: string,
  overrides: Partial<Doc<"threads">> = {},
): Doc<"threads"> {
  return {
    _id: id as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title: id,
    slug: id,
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

function task(id: string, overrides: Partial<Doc<"tasks">> = {}): Doc<"tasks"> {
  return {
    _id: id as Id<"tasks">,
    _creationTime: 0,
    userId: "user1",
    text: id,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

function activity(
  id: string,
  threadId: string,
  createdAt: number,
  overrides: Partial<Doc<"activityLogs">> = {},
): Doc<"activityLogs"> {
  return {
    _id: id as Id<"activityLogs">,
    _creationTime: 0,
    userId: "user1",
    threadId: threadId as Id<"threads">,
    type: "note",
    content: id,
    createdAt,
    ...overrides,
  };
}

/**
 * Fixtures follow the `DashboardSource` contract: only Open Threads and Open
 * Tasks, and Activity Logs already newest-first and already capped. The query
 * layer guarantees all of that through its indexes, so nothing here feeds the
 * builder input it is entitled to trust.
 */
describe("buildDashboardOverview", () => {
  it("returns the caller's Areas, Threads and Tasks", () => {
    const result = buildDashboardOverview({
      areas: [area("mine")],
      threads: [thread("open")],
      tasks: [task("open")],
      activityLogs: [],
    });

    expect(result.areas.map((item) => item.id)).toEqual(["mine"]);
    expect(result.threads.map((item) => item.id)).toEqual(["open"]);
    expect(result.inbox.items.map((item) => item.id)).toEqual(["open"]);
    expect(result.inbox.totalOpen).toBe(1);
  });

  it("orders Threads by their manual order", () => {
    const result = buildDashboardOverview({
      areas: [],
      threads: [thread("second", { order: 1 }), thread("first", { order: 0 })],
      tasks: [],
      activityLogs: [],
    });

    expect(result.threads.map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("includes an Area Icon when one is stored", () => {
    const result = buildDashboardOverview({
      areas: [area("health", { icon: "HeartPulse" })],
      threads: [],
      tasks: [],
      activityLogs: [],
    });

    expect(result.areas).toEqual([
      expect.objectContaining({ id: "health", icon: "HeartPulse" }),
    ]);
  });

  it("returns every Open Task in the shared attention order", () => {
    const currentDate = new Date(2026, 6, 17, 12).getTime();
    const result = buildDashboardOverview(
      {
        areas: [],
        threads: [],
        activityLogs: [],
        tasks: [
          task("future", {
            when: new Date(2026, 6, 20).getTime(),
            createdAt: 1,
          }),
          task("undated-new", { createdAt: 400 }),
          task("overdue", {
            when: new Date(2026, 6, 15).getTime(),
            createdAt: 2,
          }),
          task("today", {
            when: new Date(2026, 6, 17).getTime(),
            createdAt: 3,
          }),
          task("undated-old", { createdAt: 10 }),
        ],
      },
      currentDate,
    );

    expect(result.inbox.items.map((item) => item.id)).toEqual([
      "overdue",
      "today",
      "undated-new",
      "undated-old",
      "future",
    ]);
    expect(result.inbox.totalOpen).toBe(5);
  });

  it("returns the latest entry per distinct open Thread", () => {
    // Activity Logs span every Thread the user has, so entries can point at a
    // Thread missing from `threads` — a resolved one. Those are dropped.
    const result = buildDashboardOverview({
      areas: [],
      tasks: [],
      threads: [thread("a"), thread("b")],
      activityLogs: [
        activity("resolved-log", "resolved", 50),
        activity("a-new", "a", 40),
        activity("b-new", "b", 30),
        activity("a-old", "a", 10),
      ],
    });

    expect(result.recentActivity.map((item) => item.id)).toEqual([
      "a-new",
      "b-new",
    ]);
  });
});
