import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "./dashboard-screen";

const useQuery = vi.fn();

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}));

vi.mock("@/features/areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

describe("DashboardScreen", () => {
  beforeEach(() => useQuery.mockReset());

  it("renders a layout-matched loading state", () => {
    useQuery.mockReturnValue(undefined);
    render(<DashboardScreen />);

    expect(screen.getByTestId("dashboard-overview-skeleton")).toBeVisible();
  });

  it("renders the first-run Area creation state", () => {
    useQuery.mockReturnValue({
      areas: [],
      threads: [],
      inbox: { items: [], totalOpen: 0 },
      recentActivity: [],
    });
    render(<DashboardScreen />);

    expect(
      screen.getByRole("button", { name: "Create Life Area" }),
    ).toBeVisible();
  });
});
