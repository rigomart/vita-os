import { describe, expect, it, vi } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";

import {
  applyThreadPatch,
  buildCompleteNextMoveChange,
  buildThreadLifecyclePatch,
  buildThreadPatchLogEntries,
  completeNextMove,
} from "./threadChanges";

function makeThread(overrides: Partial<Doc<"threads">> = {}): Doc<"threads"> {
  return {
    _id: "thread1" as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title: "Thread",
    slug: "thread-00000000",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

describe("buildThreadPatchLogEntries", () => {
  describe("nextMove", () => {
    it("logs when setting a next move from empty", () => {
      const logs = buildThreadPatchLogEntries(makeThread(), {
        nextMove: "Call clinic",
      });

      expect(logs).toEqual([
        {
          type: "next_action_change",
          content: 'Next move set to "Call clinic"',
          previousValue: undefined,
          newValue: "Call clinic",
        },
      ]);
    });

    it("logs when changing an existing next move", () => {
      const logs = buildThreadPatchLogEntries(
        makeThread({ nextMove: "Call clinic" }),
        { nextMove: "Book checkup" },
      );

      expect(logs).toEqual([
        {
          type: "next_action_change",
          content: 'Next move changed from "Call clinic" to "Book checkup"',
          previousValue: "Call clinic",
          newValue: "Book checkup",
        },
      ]);
    });

    it("logs when clearing next move", () => {
      const logs = buildThreadPatchLogEntries(
        makeThread({ nextMove: "Call clinic" }),
        { nextMove: undefined },
      );

      expect(logs).toEqual([
        {
          type: "next_action_change",
          content: "Next move cleared",
          previousValue: "Call clinic",
          newValue: undefined,
        },
      ]);
    });

    it("does not log when next move stays the same", () => {
      const logs = buildThreadPatchLogEntries(
        makeThread({ nextMove: "Call clinic" }),
        { nextMove: "Call clinic" },
      );

      expect(logs).toEqual([]);
    });
  });

  it("records lifecycle changes", () => {
    const logs = buildThreadPatchLogEntries(makeThread(), {
      state: "resolved",
    });

    expect(logs).toEqual([
      {
        type: "state_change",
        content: 'Lifecycle changed from "open" to "resolved"',
        previousValue: "open",
        newValue: "resolved",
      },
    ]);
  });

  describe("followUp", () => {
    const may20 = new Date("2026-05-20").getTime();
    const jun1 = new Date("2026-06-01").getTime();

    it("logs when setting a follow-up from empty", () => {
      const logs = buildThreadPatchLogEntries(makeThread(), {
        followUp: may20,
      });

      expect(logs).toEqual([
        {
          type: "follow_up_change",
          content: 'Follow-up set to "May 20, 2026"',
          previousValue: undefined,
          newValue: "May 20, 2026",
        },
      ]);
    });

    it("logs when changing an existing follow-up", () => {
      const logs = buildThreadPatchLogEntries(
        makeThread({ followUp: may20 } satisfies Partial<Doc<"threads">>),
        { followUp: jun1 },
      );

      expect(logs).toEqual([
        {
          type: "follow_up_change",
          content: 'Follow-up changed from "May 20, 2026" to "Jun 1, 2026"',
          previousValue: "May 20, 2026",
          newValue: "Jun 1, 2026",
        },
      ]);
    });

    it("logs when clearing a follow-up", () => {
      const logs = buildThreadPatchLogEntries(
        makeThread({ followUp: may20 } satisfies Partial<Doc<"threads">>),
        { followUp: undefined },
      );

      expect(logs).toEqual([
        {
          type: "follow_up_change",
          content: "Follow-up cleared",
          previousValue: "May 20, 2026",
          newValue: undefined,
        },
      ]);
    });

    it("does not log when follow-up stays the same", () => {
      const logs = buildThreadPatchLogEntries(
        makeThread({ followUp: may20 } satisfies Partial<Doc<"threads">>),
        { followUp: may20 },
      );

      expect(logs).toEqual([]);
    });
  });
});

describe("buildThreadLifecyclePatch", () => {
  it("resolves an open Thread, clears next move and follow-up, and records the note", () => {
    const change = buildThreadLifecyclePatch(
      makeThread({
        state: "open",
        nextMove: "Call clinic",
        followUp: new Date("2026-05-20").getTime(),
      }),
      {
        state: "resolved",
        resolutionNote: "Clinic confirmed no further action",
      },
    );

    expect(change).toEqual({
      patch: {
        state: "resolved",
        nextMove: undefined,
        followUp: undefined,
      },
      log: {
        type: "state_change",
        content: "Resolved thread: Clinic confirmed no further action",
        previousValue: "open",
        newValue: "resolved",
      },
    });
  });

  it("reopens a resolved Thread without restoring the old follow-up", () => {
    const change = buildThreadLifecyclePatch(
      makeThread({ state: "resolved", followUp: undefined }),
      { state: "open" },
    );

    expect(change).toEqual({
      patch: { state: "open" },
      log: {
        type: "state_change",
        content: "Reopened thread",
        previousValue: "resolved",
        newValue: "open",
      },
    });
  });
});

describe("applyThreadPatch", () => {
  it("strips client-only fields before writing the thread patch", async () => {
    const thread = makeThread();
    const followUp = new Date("2026-05-20").getTime();
    const db = {
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    const ctx = { db } as unknown as Parameters<typeof applyThreadPatch>[0];
    const unsafePatch = {
      id: "client-thread-id",
      key: "dashboard-row-key",
      followUp,
    } as unknown as Parameters<typeof applyThreadPatch>[1]["patch"];

    await applyThreadPatch(ctx, {
      userId: "user1",
      thread,
      patch: unsafePatch,
    });

    expect(db.patch).toHaveBeenCalledWith(thread._id, { followUp });
    expect(db.patch.mock.calls[0]?.[1]).not.toHaveProperty("id");
    expect(db.patch.mock.calls[0]?.[1]).not.toHaveProperty("key");
    expect(db.insert).toHaveBeenCalledWith("activityLogs", {
      userId: "user1",
      threadId: thread._id,
      type: "follow_up_change",
      content: 'Follow-up set to "May 20, 2026"',
      previousValue: undefined,
      newValue: "May 20, 2026",
      createdAt: expect.any(Number),
    });
  });

  it("does not write a full thread document when the loaded thread has client-only fields", async () => {
    const followUp = new Date("2026-05-20").getTime();
    const thread = {
      ...makeThread(),
      id: "k977clientprojection",
      key: "dashboard-row-key",
    } as unknown as Doc<"threads">;
    const db = {
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    const ctx = { db } as unknown as Parameters<typeof applyThreadPatch>[0];

    await applyThreadPatch(ctx, {
      userId: "user1",
      thread,
      patch: { followUp },
    });

    expect(db.patch).toHaveBeenCalledWith(thread._id, { followUp });
    expect(db.patch.mock.calls[0]?.[1]).not.toMatchObject({
      id: "k977clientprojection",
      key: "dashboard-row-key",
      userId: "user1",
      title: "Thread",
      areaId: "area1",
      order: 0,
      state: "open",
      createdAt: 0,
    });
    expect(db.insert).toHaveBeenCalledWith("activityLogs", {
      userId: "user1",
      threadId: thread._id,
      type: "follow_up_change",
      content: 'Follow-up set to "May 20, 2026"',
      previousValue: undefined,
      newValue: "May 20, 2026",
      createdAt: expect.any(Number),
    });
  });
});

describe("buildCompleteNextMoveChange", () => {
  it("logs the completed next move", () => {
    const change = buildCompleteNextMoveChange("Call clinic");

    expect(change).toEqual({
      log: {
        type: "next_action_change",
        content: 'Completed "Call clinic" — next move cleared',
        previousValue: "Call clinic",
        newValue: undefined,
      },
    });
  });

  it("does nothing when there is no next move", () => {
    expect(buildCompleteNextMoveChange(undefined)).toBeNull();
  });
});

describe("completeNextMove", () => {
  it("stamps the Thread's last activity with the completion entry", async () => {
    const thread = makeThread({ nextMove: "Call clinic" });
    const db = {
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
    };
    const ctx = { db } as unknown as Parameters<typeof completeNextMove>[0];

    await completeNextMove(ctx, { userId: "user1", thread });

    expect(db.patch.mock.calls[0]).toEqual([
      thread._id,
      { nextMove: undefined },
    ]);
    expect(db.patch.mock.calls[1]).toEqual([
      thread._id,
      {
        lastActivityAt: expect.any(Number),
        lastActivityContent: 'Completed "Call clinic" — next move cleared',
      },
    ]);
  });
});
