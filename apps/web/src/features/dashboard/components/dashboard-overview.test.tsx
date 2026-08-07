import type { ComponentPropsWithoutRef } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

// The Plan canvas is a live surface of its own — Convex mutations, drag and
// drop, the Thread rail. Here we only care that the dashboard hands it the
// full open set.
vi.mock("@/features/dashboard/plan", () => ({
  PlanCanvas: ({
    tasks,
    threads,
  }: {
    tasks: unknown[];
    threads: unknown[];
  }) => (
    <div data-testid="plan-canvas">
      {threads.length} Threads · {tasks.length} Tasks
    </div>
  ),
}));

const currentDate = new Date(2026, 6, 17, 12).getTime();

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

  it("keeps the attention list and Inbox in the mobile-only block", () => {
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [thread("Insurance appeal")],
          inbox: {
            items: [
              {
                id: "task",
                text: "Renew passport",
                when: currentDate,
                createdAt: currentDate,
              },
            ],
            totalOpen: 3,
          },
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    const threadRow = screen.getByRole("link", { name: /insurance appeal/i });
    expect(threadRow.closest(".sm\\:hidden")).not.toBeNull();

    const inboxLink = screen.getByRole("link", { name: /inbox 3/i });
    expect(inboxLink).toHaveAttribute("href", "/inbox");
    expect(inboxLink.closest(".sm\\:hidden")).not.toBeNull();
    expect(screen.getByText("2 more Tasks in Inbox")).toBeVisible();

    expect(
      screen.getByTestId("plan-canvas").closest(".sm\\:hidden"),
    ).toBeNull();
  });

  it("shows date rails and keeps Open Threads inline", () => {
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [
            thread("Due today", { followUp: currentDate }),
            thread("Due tomorrow", {
              followUp: new Date(2026, 6, 18, 12).getTime(),
            }),
            thread("Due later", {
              followUp: new Date(2026, 6, 20, 12).getTime(),
            }),
            thread("Without date"),
          ],
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText("Due today")).toBeVisible();
    expect(screen.getByText("18")).toBeVisible();
    expect(screen.getByText("20")).toBeVisible();
    expect(screen.getByRole("link", { name: /without date/i })).toBeVisible();
  });

  it("places upcoming Follow-ups before Next Moves and Open Threads", () => {
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [
            thread("Overdue thread", {
              followUp: new Date(2026, 6, 16).getTime(),
            }),
            thread("Next Move thread", { nextMove: "Make the call" }),
            thread("Upcoming thread", {
              followUp: new Date(2026, 6, 18).getTime(),
            }),
            thread("Open thread"),
          ],
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    const overdue = screen.getByText("Overdue thread");
    const upcoming = screen.getByText("Upcoming thread");
    const nextMoves = screen.getByText("Next Move thread");
    const open = screen.getByText("Open thread");

    expect(overdue.compareDocumentPosition(upcoming)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(upcoming.compareDocumentPosition(nextMoves)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(nextMoves.compareDocumentPosition(open)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("caps plain Open Threads behind a Show all control", async () => {
    const user = userEvent.setup();
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [
            thread("Overdue thread", {
              followUp: new Date(2026, 6, 16).getTime(),
            }),
            thread("Next Move thread", { nextMove: "Make the call" }),
            ...Array.from({ length: 7 }, (_, index) =>
              thread(`Open ${index + 1}`),
            ),
          ],
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText("Overdue thread")).toBeVisible();
    expect(screen.getByText("Next Move thread")).toBeVisible();
    expect(screen.getByText("Open 5")).toBeVisible();
    expect(screen.queryByText("Open 6")).toBeNull();

    const showAll = screen.getByRole("button", { name: /show all/i });
    expect(showAll).toHaveTextContent("2 more");

    await user.click(showAll);

    expect(screen.getByText("Open 6")).toBeVisible();
    expect(screen.getByText("Open 7")).toBeVisible();
    expect(screen.queryByRole("button", { name: /show all/i })).toBeNull();
    expect(
      screen
        .getByText("Open 5")
        .compareDocumentPosition(screen.getByText("Open 6")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("never caps attention-bearing Threads and skips the control at the cap", () => {
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [
            ...Array.from({ length: 7 }, (_, index) =>
              thread(`Overdue ${index + 1}`, {
                followUp: new Date(2026, 6, 16).getTime(),
              }),
            ),
            ...Array.from({ length: 5 }, (_, index) =>
              thread(`Open ${index + 1}`),
            ),
          ],
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText("Overdue 7")).toBeVisible();
    expect(screen.getByText("Open 5")).toBeVisible();
    expect(screen.queryByRole("button", { name: /show all/i })).toBeNull();
  });

  it("preserves Area onboarding and the no-Thread state", async () => {
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

    rerender(
      <DashboardOverview
        overview={dashboard()}
        currentDate={currentDate}
        onCreateArea={onCreateArea}
      />,
    );
    expect(
      screen.getByText("Your Life Areas are clear for now."),
    ).toBeVisible();
    expect(screen.getByText("Inbox is clear")).toBeVisible();
  });
});
