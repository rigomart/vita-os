import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInboxSurface } from "./use-inbox-surface";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { thread: "kitchen-faucet" } as Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}));

function lastNavigation() {
  return mocks.navigate.mock.calls.at(-1)?.[0] as {
    replace: boolean;
    search: (previous: object) => object;
    to: string;
  };
}

describe("useInboxSurface", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    mocks.search = { thread: "kitchen-faucet" };
  });

  it("opens over the current page, keeping the rest of the search", () => {
    const { result } = renderHook(() => useInboxSurface());

    expect(result.current.isOpen).toBe(false);
    result.current.open();

    const navigation = lastNavigation();
    expect(navigation.to).toBe(".");
    expect(navigation.replace).toBe(true);
    expect(navigation.search(mocks.search)).toEqual({
      inbox: true,
      thread: "kitchen-faucet",
    });
  });

  it("strips only the inbox param on close", () => {
    mocks.search = { inbox: true, thread: "kitchen-faucet" };
    const { result } = renderHook(() => useInboxSurface());

    expect(result.current.isOpen).toBe(true);
    result.current.close();

    expect(lastNavigation().search(mocks.search)).toEqual({
      inbox: undefined,
      thread: "kitchen-faucet",
    });
  });

  it("toggles closed while the surface is open", () => {
    mocks.search = { inbox: true };
    const { result } = renderHook(() => useInboxSurface());

    result.current.toggle();

    expect(lastNavigation().search(mocks.search)).toEqual({ inbox: undefined });
  });
});
