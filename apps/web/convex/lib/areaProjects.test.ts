import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { areaBelongsToUser, getAreaDeletionBlocker } from "./areaProjects";
import { DEFAULT_HEALTH_STATUS } from "./healthStatus";

function makeArea(overrides: Partial<Doc<"areas">> = {}): Doc<"areas"> {
  return {
    _id: "area1" as Id<"areas">,
    _creationTime: 0,
    userId: "user1",
    name: "Family Health",
    slug: "family-health-00000000",
    healthStatus: DEFAULT_HEALTH_STATUS,
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: "project1" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Book checkup",
    slug: "book-checkup-00000000",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "active",
    createdAt: 0,
    ...overrides,
  };
}

describe("areaBelongsToUser", () => {
  it("accepts an Area owned by the user", () => {
    expect(areaBelongsToUser(makeArea(), "user1")).toBe(true);
  });

  it("rejects missing Areas", () => {
    expect(areaBelongsToUser(null, "user1")).toBe(false);
  });

  it("rejects Areas owned by another user", () => {
    expect(areaBelongsToUser(makeArea({ userId: "user2" }), "user1")).toBe(
      false,
    );
  });
});

describe("getAreaDeletionBlocker", () => {
  it("allows deleting Areas with no Projects", () => {
    expect(getAreaDeletionBlocker([])).toBeNull();
  });

  it.each([
    "active",
    "completed",
    "dropped",
  ] as const)("blocks deleting an Area with a %s Project", (state) => {
    const project = makeProject({ state });

    expect(getAreaDeletionBlocker([project])).toBe(project);
  });
});
