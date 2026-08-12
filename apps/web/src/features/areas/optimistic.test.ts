import type { Doc, Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { describe, expect, it } from "vitest";

import { createLocalStore } from "@/test/optimistic-local-store";

import {
  buildOptimisticArea,
  optimisticallyRemoveArea,
  optimisticallyUpdateArea,
} from "./optimistic";

function makeArea(overrides: Partial<Doc<"areas">> = {}): Doc<"areas"> {
  return {
    _id: "area1" as Id<"areas">,
    _creationTime: 0,
    userId: "user1",
    name: "Family Health",
    slug: "family-health",
    condition: "healthy",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

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

  it("patches the Area in the list and on its own page", () => {
    const area = makeArea();
    const localStore = createLocalStore();

    localStore.set(api.areas.list, {}, [area]);
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area, threads: [] },
    );

    optimisticallyUpdateArea(localStore.store, {
      id: area._id,
      condition: "critical",
    });

    expect(localStore.get(api.areas.list, {})).toEqual([
      { ...area, condition: "critical" },
    ]);
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toEqual({ area: { ...area, condition: "critical" }, threads: [] });
  });

  it("drops a removed Area from the list and nulls its page", () => {
    const area = makeArea();
    const localStore = createLocalStore();

    localStore.set(api.areas.list, {}, [area]);
    localStore.set(
      api.areas.detailBySlug,
      { slug: "family-health" },
      { area, threads: [] },
    );

    optimisticallyRemoveArea(localStore.store, { id: area._id });

    expect(localStore.get(api.areas.list, {})).toEqual([]);
    expect(
      localStore.get(api.areas.detailBySlug, { slug: "family-health" }),
    ).toBe(null);
  });
});
