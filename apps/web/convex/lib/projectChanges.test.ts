import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  buildCompleteNextMoveChange,
  buildProjectPatchLogEntries,
} from "./projectChanges";

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: "project1" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Thread",
    slug: "thread-00000000",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "active",
    createdAt: 0,
    ...overrides,
  };
}

describe("buildProjectPatchLogEntries", () => {
  it("records status changes", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({ status: "Blocked" }),
      { status: "Moving again" },
    );

    expect(logs).toEqual([
      {
        type: "status_change",
        content: 'Status changed from "Blocked" to "Moving again"',
        previousValue: "Blocked",
        newValue: "Moving again",
      },
    ]);
  });

  it("records status clearing", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({ status: "Blocked" }),
      { status: undefined },
    );

    expect(logs).toEqual([
      {
        type: "status_change",
        content: 'Status changed from "Blocked" to "(cleared)"',
        previousValue: "Blocked",
        newValue: undefined,
      },
    ]);
  });

  describe("nextMove", () => {
    it("logs when setting a next move from empty", () => {
      const logs = buildProjectPatchLogEntries(makeProject(), {
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
      const logs = buildProjectPatchLogEntries(
        makeProject({ nextMove: "Call clinic" }),
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
      const logs = buildProjectPatchLogEntries(
        makeProject({ nextMove: "Call clinic" }),
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
      const logs = buildProjectPatchLogEntries(
        makeProject({ nextMove: "Call clinic" }),
        { nextMove: "Call clinic" },
      );

      expect(logs).toEqual([]);
    });
  });

  it("records state changes", () => {
    const logs = buildProjectPatchLogEntries(makeProject(), {
      state: "completed",
    });

    expect(logs).toEqual([
      {
        type: "state_change",
        content: 'State changed from "active" to "completed"',
        previousValue: "active",
        newValue: "completed",
      },
    ]);
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
