import type { Doc, Id } from "@convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { buildOptimisticProject, completeNextAction } from "./optimistic";

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

describe("Project optimistic updates", () => {
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
