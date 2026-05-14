import type { Doc, Id } from "@convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  buildOptimisticArea,
  buildOptimisticProject,
  completeNextAction,
  nextOrder,
  patchById,
  removeById,
} from "./optimistic-updates";

function makeArea(overrides: Partial<Doc<"areas">> = {}): Doc<"areas"> {
  return {
    _id: "area1" as Id<"areas">,
    _creationTime: 0,
    userId: "user1",
    name: "Family Health",
    healthStatus: "healthy",
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
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "active",
    createdAt: 0,
    ...overrides,
  };
}

describe("optimistic update helpers", () => {
  it("patches an item by id without mutating other items", () => {
    const area = makeArea();
    const other = makeArea({ _id: "area2" as Id<"areas">, name: "Career" });

    expect(patchById([area, other], area._id, { name: "Health" })).toEqual([
      { ...area, name: "Health" },
      other,
    ]);
  });

  it("removes an item by id", () => {
    const area = makeArea();
    const other = makeArea({ _id: "area2" as Id<"areas">, name: "Career" });

    expect(removeById([area, other], area._id)).toEqual([other]);
  });

  it("computes the next order after the current max", () => {
    expect(nextOrder([{ order: 2 }, { order: 9 }, { order: 4 }])).toBe(10);
  });

  it("starts order at zero for an empty list", () => {
    expect(nextOrder([])).toBe(0);
  });

  it("builds optimistic Areas without inventing a slug", () => {
    expect(
      buildOptimisticArea(
        {
          name: "Family Health",
          standard: "Appointments are current",
          healthStatus: "healthy",
        },
        { id: "area1" as Id<"areas">, now: 123, order: 4 },
      ),
    ).toEqual({
      _id: "area1",
      _creationTime: 123,
      userId: "",
      name: "Family Health",
      standard: "Appointments are current",
      healthStatus: "healthy",
      order: 4,
      createdAt: 123,
    });
  });

  it("builds optimistic Projects without inventing a slug", () => {
    expect(
      buildOptimisticProject(
        {
          name: "Book checkup",
          definitionOfDone: "Appointment scheduled",
          areaId: "area1" as Id<"areas">,
        },
        { id: "project1" as Id<"projects">, now: 123, order: 4 },
      ),
    ).toEqual({
      _id: "project1",
      _creationTime: 123,
      userId: "",
      name: "Book checkup",
      definitionOfDone: "Appointment scheduled",
      areaId: "area1",
      order: 4,
      state: "active",
      createdAt: 123,
    });
  });

  it("optimistically completes the current Action queue entry", () => {
    const project = makeProject({
      actionQueue: [
        { id: "a1", text: "Call clinic" },
        { id: "a2", text: "Book checkup" },
      ],
    });

    expect(completeNextAction(project)).toEqual({
      ...project,
      actionQueue: [{ id: "a2", text: "Book checkup" }],
    });
  });
});
