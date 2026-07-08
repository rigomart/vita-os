import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardOverview } from "./dashboard-overview";

describe("DashboardOverview", () => {
  it("does not show first-run Area setup while the overview query is loading", () => {
    render(
      <DashboardOverview
        overview={undefined}
        currentDate={1}
        onCreateArea={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(/map your life domains as areas/i),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-overview-skeleton")).toBeVisible();
  });

  it("shows first-run Area setup after overview loads with no Areas or attention Threads", () => {
    render(
      <DashboardOverview
        overview={{ areas: [], threads: [] }}
        currentDate={1}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText(/map your life domains as areas/i)).toBeVisible();
    expect(
      screen.queryByTestId("dashboard-overview-skeleton"),
    ).not.toBeInTheDocument();
  });

  it("shows first-run Area setup when overview loads without Threads", () => {
    render(
      <DashboardOverview
        overview={{ areas: [] }}
        currentDate={1}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText(/map your life domains as areas/i)).toBeVisible();
    expect(
      screen.queryByTestId("dashboard-overview-skeleton"),
    ).not.toBeInTheDocument();
  });
});
