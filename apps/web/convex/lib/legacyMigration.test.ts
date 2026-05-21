import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  buildAreaConditionPatch,
  buildGeneratedActivityLogEntries,
  buildMigratedActivityLogFromProjectLog,
  buildMigratedTask,
  buildMigratedThread,
  type LegacyAreaForMigration,
} from "./legacyMigration";

const areaId = "area1" as Id<"areas">;
const projectId = "project1" as Id<"projects">;
const itemId = "item1" as Id<"items">;
const projectLogId = "projectLog1" as Id<"projectLogs">;
const threadId = "thread1";
const may20 = Date.UTC(2026, 4, 20);
const jun1 = Date.UTC(2026, 5, 1);

function makeArea(
  overrides: Partial<LegacyAreaForMigration> = {},
): LegacyAreaForMigration {
  return {
    _id: areaId,
    _creationTime: 0,
    userId: "user1",
    name: "Health",
    slug: "health",
    healthStatus: "needs_attention",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: projectId,
    _creationTime: 0,
    userId: "user1",
    name: "Book checkup",
    slug: "book-checkup",
    definitionOfDone: "Annual physical is complete",
    areaId,
    order: 2,
    state: "open",
    createdAt: 1000,
    ...overrides,
  };
}

function makeItem(overrides: Partial<Doc<"items">> = {}): Doc<"items"> {
  return {
    _id: itemId,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    isCompleted: false,
    createdAt: 1000,
    ...overrides,
  };
}

function makeProjectLog(
  overrides: Partial<Doc<"projectLogs">> = {},
): Doc<"projectLogs"> {
  return {
    _id: projectLogId,
    _creationTime: 0,
    userId: "user1",
    projectId,
    type: "note",
    content: "Called clinic",
    createdAt: 500,
    ...overrides,
  };
}

describe("legacy Area migration", () => {
  it("backfills Condition from healthStatus", () => {
    expect(buildAreaConditionPatch(makeArea())).toEqual({
      condition: "needs_attention",
    });
  });

  it("skips Areas whose Condition already matches healthStatus", () => {
    expect(
      buildAreaConditionPatch(makeArea({ condition: "needs_attention" })),
    ).toBeNull();
  });
});

describe("legacy Project to Thread migration", () => {
  it.each([
    ["open", "open"],
    ["active", "open"],
    ["completed", "resolved"],
    ["dropped", "resolved"],
  ] as const)("maps %s lifecycle state to %s", (legacyState, threadState) => {
    expect(buildMigratedThread(makeProject({ state: legacyState })).state).toBe(
      threadState,
    );
  });

  it("maps title, Area, Summary, order, slug, and legacy id", () => {
    expect(buildMigratedThread(makeProject())).toEqual({
      userId: "user1",
      title: "Book checkup",
      slug: "book-checkup",
      summary: "Annual physical is complete",
      areaId,
      order: 2,
      state: "open",
      legacyProjectId: projectId,
      createdAt: 1000,
    });
  });

  it("prefers existing nextMove over actionQueue[0]", () => {
    const thread = buildMigratedThread(
      makeProject({
        nextMove: "Call clinic",
        actionQueue: [{ id: "a1", text: "Open portal" }],
      }),
    );

    expect(thread.nextMove).toBe("Call clinic");
  });

  it("uses actionQueue[0] as Next Move when nextMove is empty", () => {
    const thread = buildMigratedThread(
      makeProject({
        actionQueue: [{ id: "a1", text: "Open portal" }],
      }),
    );

    expect(thread.nextMove).toBe("Open portal");
  });

  it("uses waitingFollowUpDate as Follow-up when followUp is empty", () => {
    const thread = buildMigratedThread(
      makeProject({ waitingFollowUpDate: may20 }),
    );

    expect(thread.followUp).toBe(may20);
  });

  it("clears active Next Move and Follow-up from resolved Threads", () => {
    const thread = buildMigratedThread(
      makeProject({
        state: "completed",
        nextMove: "Call clinic",
        followUp: may20,
      }),
    );

    expect(thread.state).toBe("resolved");
    expect(thread).not.toHaveProperty("nextMove");
    expect(thread).not.toHaveProperty("followUp");
  });

  it("generates Activity Log entries for legacy-only Project fields", () => {
    const logs = buildGeneratedActivityLogEntries(
      makeProject({
        state: "dropped",
        status: "Blocked",
        nextMove: "Call clinic",
        followUp: may20,
        actionQueue: [
          { id: "a1", text: "Call clinic" },
          { id: "a2", text: "Book appointment" },
        ],
        waitingOn: "Clinic",
        waitingSince: may20,
        waitingExpectedDate: jun1,
        waitingFollowUpDate: jun1,
        actionDate: may20,
        targetDate: jun1,
      }),
    );

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "reference",
          migrationSourceKey: "legacy:definitionOfDone",
          newValue: "Annual physical is complete",
        }),
        expect.objectContaining({
          type: "state_change",
          migrationSourceKey: "legacy:state",
          previousValue: "dropped",
          newValue: "resolved",
        }),
        expect.objectContaining({
          type: "status_change",
          migrationSourceKey: "legacy:status",
          newValue: "Blocked",
        }),
        expect.objectContaining({
          type: "waiting_change",
          migrationSourceKey: "legacy:waiting",
          content:
            "Legacy waiting context preserved: waiting on Clinic; waiting since May 20, 2026; expected Jun 1, 2026; waiting follow-up Jun 1, 2026",
        }),
        expect.objectContaining({
          type: "reference",
          migrationSourceKey: "legacy:actionDate",
          newValue: "May 20, 2026",
        }),
        expect.objectContaining({
          type: "reference",
          migrationSourceKey: "legacy:targetDate",
          newValue: "Jun 1, 2026",
        }),
        expect.objectContaining({
          type: "next_action_change",
          migrationSourceKey: "legacy:nextMove",
          newValue: "Call clinic",
        }),
        expect.objectContaining({
          type: "follow_up_change",
          migrationSourceKey: "legacy:followUp",
          newValue: "May 20, 2026",
        }),
        expect.objectContaining({
          type: "next_action_change",
          migrationSourceKey: "legacy:actionQueue:1",
          newValue: "Book appointment",
        }),
      ]),
    );
  });
});

describe("legacy Item to Task migration", () => {
  it("maps open Items to open Tasks with When", () => {
    expect(buildMigratedTask(makeItem({ date: may20 }))).toEqual({
      userId: "user1",
      text: "Call clinic",
      when: may20,
      state: "open",
      legacyItemId: itemId,
      createdAt: 1000,
    });
  });

  it("maps completed Items to done Tasks with completedAt", () => {
    expect(
      buildMigratedTask(makeItem({ isCompleted: true, completedAt: jun1 })),
    ).toEqual({
      userId: "user1",
      text: "Call clinic",
      state: "done",
      completedAt: jun1,
      legacyItemId: itemId,
      createdAt: 1000,
    });
  });
});

describe("legacy Project log to Activity Log migration", () => {
  it("preserves existing Project log fields and timestamp", () => {
    expect(
      buildMigratedActivityLogFromProjectLog(
        makeProjectLog({
          type: "status_change",
          previousValue: "Blocked",
          newValue: "Moving",
        }),
        threadId,
      ),
    ).toEqual({
      userId: "user1",
      threadId,
      type: "status_change",
      content: "Called clinic",
      previousValue: "Blocked",
      newValue: "Moving",
      legacyProjectLogId: projectLogId,
      legacyProjectId: projectId,
      createdAt: 500,
    });
  });
});
