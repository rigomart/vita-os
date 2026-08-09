import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "./dashboard-screen";

const useQuery = vi.fn();

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}));

vi.mock("@/features/areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

const emptyOverview = {
  areas: [],
  threads: [],
  inbox: { items: [], totalOpen: 0 },
  recentActivity: [],
};

describe("DashboardScreen", () => {
  beforeEach(() => useQuery.mockReset());

  afterEach(() => vi.useRealTimers());

  it("renders a layout-matched loading state", () => {
    useQuery.mockReturnValue(undefined);
    render(<DashboardScreen />);

    expect(screen.getByTestId("dashboard-overview-skeleton")).toBeVisible();
  });

  it("renders the first-run Area creation state", () => {
    useQuery.mockReturnValue(emptyOverview);
    render(<DashboardScreen />);

    expect(
      screen.getByRole("button", { name: "Create Life Area" }),
    ).toBeVisible();
  });

  it("moves the date and requeries when the day rolls over", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 17, 23, 30));
    useQuery.mockReturnValue(emptyOverview);
    render(<DashboardScreen />);

    expect(screen.getByText("Jul")).toBeVisible();
    expect(screen.getByText("17")).toBeVisible();
    expect(useQuery.mock.lastCall?.[1]).toEqual({
      currentDate: new Date(2026, 6, 17, 23, 30).getTime(),
      timezoneOffsetMinutes: new Date(2026, 6, 17).getTimezoneOffset(),
    });

    act(() => vi.advanceTimersByTime(30 * 60_000));

    expect(screen.getByText("18")).toBeVisible();
    expect(useQuery.mock.lastCall?.[1]).toMatchObject({
      currentDate: new Date(2026, 6, 18).getTime(),
    });
  });
});
