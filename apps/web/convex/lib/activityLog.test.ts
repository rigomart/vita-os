import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  AUTO_ACTIVITY_LOG_ENTRY_TYPES,
  buildAreaMoveLogEntry,
} from "./activityLog";
import { buildProjectPatchLogEntries } from "./projectChanges";

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: "project1" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Renew passport",
    slug: "renew-passport",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

describe("buildAreaMoveLogEntry", () => {
  it("records the from and to Area names", () => {
    expect(buildAreaMoveLogEntry("Health", "Finances")).toEqual({
      type: "area_move",
      content: 'Moved from "Health" to "Finances"',
      previousValue: "Health",
      newValue: "Finances",
    });
  });
});

describe("buildProjectPatchLogEntries area moves", () => {
  it("records an Area move when the thread changes Areas", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({ areaId: "area1" as Id<"areas"> }),
      { areaId: "area2" as Id<"areas"> },
      { fromAreaName: "Health", toAreaName: "Finances" },
    );

    expect(logs).toEqual([
      {
        type: "area_move",
        content: 'Moved from "Health" to "Finances"',
        previousValue: "Health",
        newValue: "Finances",
      },
    ]);
  });

  it("does not record an Area move when the Area stays the same", () => {
    const logs = buildProjectPatchLogEntries(
      makeProject({ areaId: "area1" as Id<"areas"> }),
      { areaId: "area1" as Id<"areas"> },
      { fromAreaName: "Health", toAreaName: "Health" },
    );

    expect(logs).toEqual([]);
  });
});

describe("Area Condition", () => {
  it("is not modeled as a thread activity log entry type", () => {
    expect(AUTO_ACTIVITY_LOG_ENTRY_TYPES).not.toContain("condition_change");
  });
});
