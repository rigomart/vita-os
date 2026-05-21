import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";

import {
  buildCompleteNextMoveChange,
  buildThreadLifecyclePatch,
  buildThreadPatchLogEntries,
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
