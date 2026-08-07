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

describe("buildDashboardOverview", () => {
  it("isolates authenticated user data and returns open Threads and Tasks only", () => {
    const result = buildDashboardOverview("user1", {
      areas: [area("mine"), area("theirs", { userId: "user2" })],
      threads: [
        thread("open"),
        thread("resolved", { state: "resolved" }),
        thread("foreign", { userId: "user2" }),
      ],
      tasks: [
        task("open"),
        task("done", { state: "done" }),
        task("foreign", { userId: "user2" }),
      ],
      activityLogs: [],
    });

    expect(result.areas.map((item) => item.id)).toEqual(["mine"]);
    expect(result.threads.map((item) => item.id)).toEqual(["open"]);
    expect(result.inbox.items.map((item) => item.id)).toEqual(["open"]);
    expect(result.inbox.totalOpen).toBe(1);
  });

  it("includes an Area Icon when one is stored", () => {
    const result = buildDashboardOverview("user1", {
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
      "user1",
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
    const result = buildDashboardOverview("user1", {
      areas: [],
      tasks: [],
      threads: [
        thread("a"),
        thread("b"),
        thread("resolved", { state: "resolved" }),
      ],
      activityLogs: [
        activity("a-old", "a", 10),
        activity("resolved-log", "resolved", 50),
        activity("deleted-log", "deleted", 45),
        activity("a-new", "a", 40),
        activity("b-new", "b", 30),
        activity("foreign", "b", 60, { userId: "user2" }),
      ],
    });

    expect(result.recentActivity.map((item) => item.id)).toEqual([
      "a-new",
      "b-new",
    ]);
  });
});
