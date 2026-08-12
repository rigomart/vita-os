import { act, render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "./dashboard-screen";

const useQuery = vi.fn();

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}));

vi.mock("@/features/areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

vi.mock("@/features/dashboard/plan/use-plan-actions", () => ({
  usePlanActions: () => ({ planTask: vi.fn(), planThread: vi.fn() }),
}));

/** Every query the Dashboard reads, answered empty. */
function answerEmpty() {
  useQuery.mockImplementation(() => []);
}

describe("DashboardScreen", () => {
  // Braces matter: `mockReset` returns the mock, and a function returned from
  // `beforeEach` is run as a teardown hook — with no arguments.
  beforeEach(() => {
    useQuery.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("renders a layout-matched loading state while any source loads", () => {
    useQuery.mockImplementation((query: unknown) =>
      getFunctionName(query as never) === "tasks:list" ? undefined : [],
    );
    render(<DashboardScreen />);

    expect(screen.getByTestId("dashboard-overview-skeleton")).toBeVisible();
  });

  it("renders the first-run Area creation state", () => {
    answerEmpty();
    render(<DashboardScreen />);

    expect(
      screen.getByRole("button", { name: "Create Life Area" }),
    ).toBeVisible();
  });

  it("subscribes to exactly the three list queries", () => {
    answerEmpty();
    render(<DashboardScreen />);

    const names = new Set(
      useQuery.mock.calls.map(([query]) => getFunctionName(query as never)),
    );
    expect([...names].sort()).toEqual([
      "areas:list",
      "tasks:list",
      "threads:list",
    ]);
  });

  it("moves the date when the day rolls over, without requerying", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 17, 23, 30));
    answerEmpty();
    render(<DashboardScreen />);

    expect(screen.getByText("Jul")).toBeVisible();
    expect(screen.getByText("17")).toBeVisible();
    // None of the subscriptions is keyed by the date.
    expect(useQuery.mock.calls.every(([, args]) => args === undefined)).toBe(
      true,
    );

    act(() => vi.advanceTimersByTime(30 * 60_000));

    expect(screen.getByText("18")).toBeVisible();
    expect(useQuery.mock.calls.every(([, args]) => args === undefined)).toBe(
      true,
    );
  });
});
