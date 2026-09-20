import type { AreaId, AreaSummary } from "@vita-os/contracts";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateArea } from "./use-update-area";

const mocks = vi.hoisted(() => ({
  updateArea: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("../hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../hooks")>()),
  useUpdateArea: () => ({ mutateAsync: mocks.updateArea }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

function makeArea(overrides: Partial<AreaSummary> = {}): AreaSummary {
  return {
    _id: "area1" as AreaId,
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
    mocks.navigate.mockClear();
    mocks.updateArea.mockReset().mockResolvedValue(makeArea());
  });

  it("forwards the icon from the form value to the command", async () => {
    const area = makeArea();
    const { result } = renderHook(() => useUpdateArea());

    await result.current(area, {
      name: area.name,
      condition: area.condition,
      icon: "HeartPulse",
    });

    expect(mocks.updateArea).toHaveBeenCalledWith({
      areaId: area._id,
      name: area.name,
      condition: area.condition,
      icon: "HeartPulse",
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("follows the slug the service chose after a rename", async () => {
    const area = makeArea();
    mocks.updateArea.mockResolvedValue(
      makeArea({ name: "Wellbeing", slug: "wellbeing-0011aabb" }),
    );
    const { result } = renderHook(() => useUpdateArea());

    await result.current(area, {
      name: "Wellbeing",
      condition: area.condition,
      icon: area.icon,
    });

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/$areaSlug",
      params: { areaSlug: "wellbeing-0011aabb" },
      replace: true,
    });
  });
});
