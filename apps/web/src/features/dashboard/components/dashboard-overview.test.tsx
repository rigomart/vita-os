import type { ComponentPropsWithoutRef } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardOverviewData, DashboardThread } from "./dashboard-model";

import { DashboardOverview } from "./dashboard-overview";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search: _search,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & { to: string; search?: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Both Plan surfaces are live surfaces of their own — Convex mutations, drag
// and drop, the Thread rail. Here we only care which one the dashboard mounts
// and that it hands it the full open set.
vi.mock("@/features/dashboard/plan", () => {
  const stub =
    (testId: string) =>
    ({ tasks, threads }: { tasks: unknown[]; threads: unknown[] }) => (
      <div data-testid={testId}>
        {threads.length} Threads · {tasks.length} Tasks
      </div>
    );
  return {
    PlanCanvas: stub("plan-canvas"),
    PlanSchedule: stub("plan-schedule"),
  };
});

const currentDate = new Date(2026, 6, 17, 12).getTime();

/** `useIsCompact` reads `innerWidth`; jsdom's default is a desktop width. */
function compactViewport() {
  vi.stubGlobal("innerWidth", 390);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function thread(
  id: string,
  fields: Partial<DashboardThread> = {},
): DashboardThread {
  return {
    id,
    title: id,
    slug: id,
    areaId: "health",
    order: 0,
    ...fields,
  };
}

function dashboard(
  overrides: Partial<DashboardOverviewData> = {},
): DashboardOverviewData {
  return {
    areas: [
      {
        id: "health",
        name: "Health",
        slug: "health",
        condition: "critical",
        order: 0,
      },
      {
        id: "home",
        name: "Home",
        slug: "home",
        condition: "healthy",
        order: 1,
      },
    ],
    threads: [],
    inbox: { items: [], totalOpen: 0 },
    recentActivity: [],
    ...overrides,
  };
}

describe("DashboardOverview", () => {
  it("keeps attention-bearing Areas prominent in the condition strip", () => {
    render(
      <DashboardOverview
        overview={dashboard()}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    const strip = screen.getByRole("region", {
      name: "Life Areas by condition",
    });

    const criticalPill = within(strip).getByRole("link", { name: /Health/ });
    expect(criticalPill).toBeVisible();
    expect(within(criticalPill).getByText("Needs you")).toBeVisible();

    const healthyGlyph = within(strip).getByRole("link", { name: "Home" });
    expect(within(healthyGlyph).queryByText("Needs you")).toBeNull();
    expect(within(strip).getByText("1 steady")).toBeInTheDocument();

    expect(
      criticalPill.compareDocumentPosition(healthyGlyph) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("collapses to a steady line when every Area is healthy", () => {
    const overview = dashboard();
    render(
      <DashboardOverview
        overview={{
          ...overview,
          areas: overview.areas.map((area) => ({
            ...area,
            condition: "healthy" as const,
          })),
        }}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText("All areas steady.")).toBeVisible();
    expect(screen.queryByText("Needs you")).toBeNull();
    expect(screen.queryByText("Watch")).toBeNull();

    const strip = screen.getByRole("region", {
      name: "Life Areas by condition",
    });
    expect(within(strip).getByRole("link", { name: "Health" })).toBeVisible();
    expect(within(strip).getByRole("link", { name: "Home" })).toBeVisible();
  });

  it("hands the Plan canvas every open Thread and Task", () => {
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [
            thread("Check renewal", { followUp: currentDate }),
            thread("Without date"),
          ],
          inbox: {
            items: [
              {
                id: "task",
                text: "Renew passport",
                createdAt: currentDate,
              },
            ],
            totalOpen: 1,
          },
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByTestId("plan-canvas")).toHaveTextContent(
      "2 Threads · 1 Tasks",
    );
    expect(screen.queryByTestId("plan-schedule")).toBeNull();
  });

  it("swaps the canvas for the schedule on a phone-sized viewport", () => {
    compactViewport();
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [
            thread("Check renewal", { followUp: currentDate }),
            thread("Without date"),
          ],
          inbox: {
            items: [
              {
                id: "task",
                text: "Renew passport",
                createdAt: currentDate,
              },
            ],
            totalOpen: 1,
          },
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByTestId("plan-schedule")).toHaveTextContent(
      "2 Threads · 1 Tasks",
    );
    expect(screen.queryByTestId("plan-canvas")).toBeNull();
  });

  it("renders Recent activity as a strip below the canvas", () => {
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [thread("Insurance appeal")],
          recentActivity: [
            {
              id: "activity",
              threadId: "Insurance appeal",
              content: "Clinic sent the report",
              createdAt: currentDate,
            },
          ],
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText("Recent activity")).toBeVisible();
    expect(screen.getByText(/clinic sent the report/i)).toBeVisible();
    expect(
      screen
        .getByTestId("plan-canvas")
        .compareDocumentPosition(screen.getByText("Recent activity")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("omits Recent activity when there is none", () => {
    render(
      <DashboardOverview
        overview={dashboard()}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.queryByText("Recent activity")).toBeNull();
  });

  it("preserves Area onboarding until the first Area exists", async () => {
    const user = userEvent.setup();
    const onCreateArea = vi.fn();
    const { rerender } = render(
      <DashboardOverview
        overview={dashboard({ areas: [] })}
        currentDate={currentDate}
        onCreateArea={onCreateArea}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create Life Area" }));
    expect(onCreateArea).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("plan-canvas")).toBeNull();

    rerender(
      <DashboardOverview
        overview={dashboard()}
        currentDate={currentDate}
        onCreateArea={onCreateArea}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Create Life Area" }),
    ).toBeNull();
    expect(screen.getByTestId("plan-canvas")).toHaveTextContent(
      "0 Threads · 0 Tasks",
    );
  });
});
