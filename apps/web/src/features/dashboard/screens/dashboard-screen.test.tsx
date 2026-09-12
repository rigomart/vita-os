import type { ComponentPropsWithoutRef } from "react";

import { act, render, screen, within } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "./dashboard-screen";

const useQuery = vi.fn();

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

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
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}));

vi.mock("@/features/areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

// The board now renders real cards in this suite; their writes belong to the
// hooks' own tests, and a mutation here would want a ConvexProvider.
vi.mock("@/features/threads/use-complete-next-move", () => ({
  useCompleteNextMove: () => vi.fn(),
}));
vi.mock("@/features/threads/use-update-thread", () => ({
  useUpdateThread: () => vi.fn(),
}));
vi.mock("@/features/notes/use-complete-note", () => ({
  useCompleteNote: () => vi.fn(),
}));
vi.mock("@/features/notes/use-update-note-when", () => ({
  useUpdateNoteWhen: () => vi.fn(),
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
    mocks.navigate.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("renders a layout-matched loading state while any source loads", () => {
    useQuery.mockImplementation((query: unknown) =>
      getFunctionName(query as never) === "notes:list" ? undefined : [],
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
      "notes:list",
      "threads:list",
    ]);
  });

  it("reclassifies the board when the day rolls over, without requerying", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 17, 23, 30));
    // Due tomorrow at 23:30 tonight; due today once midnight passes. The date
    // itself is stated by the app chrome now, so the board's own answer to the
    // clock is what this screen has left to prove.
    useQuery.mockImplementation((query: unknown) => {
      const name = getFunctionName(query as never);
      if (name === "areas:list") {
        return [
          {
            _id: "health",
            name: "Health",
            slug: "health",
            icon: "HeartPulse",
            condition: "healthy",
            order: 0,
          },
        ];
      }
      if (name === "threads:list") {
        return [
          {
            _id: "thread1",
            title: "Dentist",
            slug: "dentist",
            areaId: "health",
            order: 0,
            state: "open",
            followUp: new Date(2026, 6, 18, 9).getTime(),
            createdAt: 0,
          },
        ];
      }
      return [];
    });
    render(<DashboardScreen />);

    const inLane = (lane: string) =>
      within(screen.getByRole("region", { name: lane })).queryByText("Dentist");

    expect(inLane("This week")).toBeVisible();
    expect(inLane("Now")).toBeNull();
    // None of the subscriptions is keyed by the date.
    expect(useQuery.mock.calls.every(([, args]) => args === undefined)).toBe(
      true,
    );

    act(() => vi.advanceTimersByTime(30 * 60_000));

    expect(inLane("Now")).toBeVisible();
    expect(useQuery.mock.calls.every(([, args]) => args === undefined)).toBe(
      true,
    );
  });
});
