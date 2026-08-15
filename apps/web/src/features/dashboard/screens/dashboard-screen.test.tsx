import type { ComponentPropsWithoutRef } from "react";

import { act, render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "./dashboard-screen";

const useQuery = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params: _params,
    search: _search,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    to: string;
    params?: unknown;
    search?: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}));

vi.mock("@/features/areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

vi.mock("@/features/dashboard/plan/use-plan-actions", () => ({
  usePlanActions: () => ({ planTask: vi.fn(), planThread: vi.fn() }),
}));

// Both Plan surfaces are live surfaces of their own; the screen tests only
// care about the queries and the date, not what the Plan renders.
vi.mock("@/features/dashboard/plan", () => ({
  PlanCanvas: () => null,
  PlanSchedule: () => null,
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
    // The date lives in the Area status bar, which needs an Area to render.
    useQuery.mockImplementation((query: unknown) =>
      getFunctionName(query as never) === "areas:list"
        ? [
            {
              _id: "health",
              name: "Health",
              slug: "health",
              icon: "HeartPulse",
              condition: "healthy",
              order: 0,
            },
          ]
        : [],
    );
    render(<DashboardScreen />);

    expect(screen.getByText(/Jul 17/)).toBeVisible();
    // None of the subscriptions is keyed by the date.
    expect(useQuery.mock.calls.every(([, args]) => args === undefined)).toBe(
      true,
    );

    act(() => vi.advanceTimersByTime(30 * 60_000));

    expect(screen.getByText(/Jul 18/)).toBeVisible();
    expect(useQuery.mock.calls.every(([, args]) => args === undefined)).toBe(
      true,
    );
  });
});
