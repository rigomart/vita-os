import type { Id } from "@convex/_generated/dataModel";

import { describe, expect, it } from "vitest";

import { buildOptimisticArea } from "./optimistic";

describe("Area optimistic updates", () => {
  it("builds optimistic Areas without inventing a slug", () => {
    expect(
      buildOptimisticArea(
        {
          name: "Family Health",
          standard: "Appointments are current",
          condition: "healthy",
          icon: "HeartPulse",
        },
        { id: "area1" as Id<"areas">, now: 123, order: 4 },
      ),
    ).toEqual({
      _id: "area1",
      _creationTime: 123,
      userId: "",
      name: "Family Health",
      standard: "Appointments are current",
      condition: "healthy",
      icon: "HeartPulse",
      order: 4,
      createdAt: 123,
    });
  });
});
