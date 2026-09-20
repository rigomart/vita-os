import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/test/render-with-providers";

import type { AreaActionTarget } from "./area-actions";

import { buildAreaActions, useAreaActions } from "./area-actions";

const mocks = vi.hoisted(() => ({
  mutation: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@vita-os/application", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vita-os/application")>()),
  useUpdateArea: () => ({
    mutateAsync: (input: unknown) => mocks.mutation("updateArea", input),
  }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

const area: AreaActionTarget = {
  condition: "needs_attention",
  id: "area1",
  name: "Family Health",
  slug: "family-health",
};

function handlers() {
  return {
    newThread: vi.fn(),
    openArea: vi.fn(),
    setCondition: vi.fn(),
  };
}

describe("buildAreaActions", () => {
  it("offers every capture, and Open — each naming the Area", () => {
    const actions = buildAreaActions(area, handlers());

    expect(actions.map((action) => action.id)).toEqual([
      "condition:healthy",
      "condition:needs_attention",
      "condition:critical",
      "new-thread",
      "open-area",
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      "Set Family Health to Healthy",
      "Set Family Health to Needs attention",
      "Set Family Health to Critical",
      "New Thread in Family Health",
      "Open Family Health",
    ]);
  });

  it("marks only the Area's current Condition active", () => {
    const actions = buildAreaActions(area, handlers());

    expect(
      actions.filter((action) => action.active).map((action) => action.id),
    ).toEqual(["condition:needs_attention"]);
  });

  it("binds each Condition action to the Condition it names", () => {
    const bound = handlers();
    const actions = buildAreaActions(area, bound);

    actions.find((action) => action.id === "condition:critical")!.run();

    expect(bound.setCondition).toHaveBeenCalledWith("critical");
    expect(bound.newThread).not.toHaveBeenCalled();
  });

  it("runs capture and Open through the host's own handlers", () => {
    const bound = handlers();
    const actions = buildAreaActions(area, bound);

    actions.find((action) => action.kind === "new-thread")!.run();
    actions.find((action) => action.kind === "open-area")!.run();

    expect(bound.newThread).toHaveBeenCalledOnce();
    expect(bound.openArea).toHaveBeenCalledOnce();
  });
});

describe("useAreaActions", () => {
  it("writes a Condition change through areas.update", () => {
    mocks.mutation.mockClear();
    const { result } = renderHook(() =>
      useAreaActions(area, { onNewThread: vi.fn() }),
    );

    result.current.setCondition("critical");

    expect(mocks.mutation).toHaveBeenCalledWith("updateArea", {
      areaId: "area1",
      condition: "critical",
    });
  });

  it("writes the same change when a Condition action is run", () => {
    mocks.mutation.mockClear();
    const { result } = renderHook(() =>
      useAreaActions(area, { onNewThread: vi.fn() }),
    );

    result.current.actions.find((a) => a.id === "condition:healthy")!.run();

    expect(mocks.mutation).toHaveBeenCalledWith("updateArea", {
      areaId: "area1",
      condition: "healthy",
    });
  });

  it("hands capture back to the host, carrying the Area id", () => {
    const onNewThread = vi.fn();
    const { result } = renderHook(() => useAreaActions(area, { onNewThread }));

    result.current.actions.find((a) => a.kind === "new-thread")!.run();

    expect(onNewThread).toHaveBeenCalledWith("area1");
  });

  it("navigates to the Area page by default, and defers when told to", () => {
    mocks.navigate.mockClear();
    const { result, rerender } = renderHook(
      ({ onOpenArea }: { onOpenArea?: () => void }) =>
        useAreaActions(area, { onNewThread: vi.fn(), onOpenArea }),
      { initialProps: {} },
    );

    result.current.actions.find((a) => a.kind === "open-area")!.run();

    expect(mocks.navigate).toHaveBeenCalledWith({
      params: { areaSlug: "family-health" },
      to: "/$areaSlug",
    });

    const onOpenArea = vi.fn();
    mocks.navigate.mockClear();
    rerender({ onOpenArea });
    result.current.actions.find((a) => a.kind === "open-area")!.run();

    expect(onOpenArea).toHaveBeenCalledWith(area);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
