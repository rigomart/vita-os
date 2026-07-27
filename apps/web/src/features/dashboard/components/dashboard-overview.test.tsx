import type { ComponentPropsWithoutRef } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  type DashboardOverviewData,
  type DashboardThread,
} from "./dashboard-model";
import { DashboardOverview } from "./dashboard-overview";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
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
  it("renders every Area condition, including clear conditions", () => {
    render(
      <DashboardOverview
        overview={dashboard()}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Critical Life Areas" }),
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Steady Life Areas" }),
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Needs attention Life Areas" }),
    ).toBeVisible();
    expect(screen.getByText("None")).toBeVisible();

    const areaStrip = screen.getByRole("region", {
      name: "Life Areas by condition",
    });
    const tabs = screen.getByRole("tablist", { name: "Dashboard view" });
    expect(
      areaStrip.compareDocumentPosition(tabs) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows exact Follow-up labels and keeps Open Threads collapsed", async () => {
    const user = userEvent.setup();
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

    expect(screen.getByText("Today")).toBeVisible();
    expect(screen.getByText("Tomorrow")).toBeVisible();
    expect(screen.getByText("Jul 20")).toBeVisible();
    expect(screen.getByText("Upcoming")).toBeVisible();
    expect(screen.queryByText("Upcoming follow-ups")).toBeNull();
    expect(screen.queryByRole("link", { name: /without date/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /open threads/i }));
    expect(screen.getByRole("link", { name: /without date/i })).toBeVisible();
  });

  it("handles Inbox clear, remaining Tasks, and optional Recent activity", () => {
    const { rerender } = render(
      <DashboardOverview
        overview={dashboard()}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    expect(screen.getByText("Inbox is clear")).toBeVisible();
    expect(screen.queryByText("Recent activity")).toBeNull();

    rerender(
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

    expect(screen.getByText("2 more Tasks in Inbox")).toBeVisible();
    expect(screen.getByRole("link", { name: /inbox 3/i })).toHaveAttribute(
      "href",
      "/inbox",
    );
    expect(screen.getByText("Recent activity")).toBeVisible();
    expect(screen.getByText(/clinic sent the report/i)).toBeVisible();
  });

  it("switches to a read-only Plan made of Thread links", async () => {
    const user = userEvent.setup();
    render(
      <DashboardOverview
        overview={dashboard({
          threads: [thread("Check renewal", { followUp: currentDate })],
        })}
        currentDate={currentDate}
        onCreateArea={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Plan" }));
    const link = screen.getByRole("link", { name: /check renewal/i });
    expect(screen.getByText("Schedule")).toBeVisible();
    expect(link).not.toHaveAttribute("draggable");
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
    expect(screen.getByText("No open Threads")).toBeVisible();
  });
});
