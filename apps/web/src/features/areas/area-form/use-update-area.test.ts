import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea } from "@convex/lib/validators";

import { renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateArea } from "./use-update-area";

const mocks = vi.hoisted(() => ({
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  navigate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: unknown) => {
    const name = getFunctionName(reference as never);
    const mutation =
      mocks.mutations.get(name) ??
      vi.fn(() => Promise.resolve(undefined as unknown));
    mocks.mutations.set(name, mutation);
    return Object.assign(mutation, {
      withOptimisticUpdate: () => mutation,
    });
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

function makeArea(overrides: Partial<ProjectedArea> = {}): ProjectedArea {
  return {
    _id: "area1" as Id<"areas">,
    name: "Health",
    slug: "health",
    icon: "Compass",
    condition: "healthy",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe("useUpdateArea", () => {
  beforeEach(() => {
    mocks.mutations.clear();
    mocks.navigate.mockClear();
  });

  it("forwards the icon from the form value to the update mutation", async () => {
    const area = makeArea();
    const { result } = renderHook(() => useUpdateArea());

    await result.current(area, {
      name: area.name,
      condition: area.condition,
      icon: "HeartPulse",
    });

    expect(mocks.mutations.get("areas:update")).toHaveBeenCalledWith({
      id: area._id,
      name: area.name,
      condition: area.condition,
      icon: "HeartPulse",
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("navigates to the new slug when the rename changes it", async () => {
    const area = makeArea();
    const update = vi.fn(() => Promise.resolve({ slug: "wellbeing" }));
    mocks.mutations.set("areas:update", update);
    const { result } = renderHook(() => useUpdateArea());

    await result.current(area, {
      name: "Wellbeing",
      condition: area.condition,
      icon: area.icon,
    });

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/$areaSlug",
      params: { areaSlug: "wellbeing" },
      replace: true,
    });
  });
});
