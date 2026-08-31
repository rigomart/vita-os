import type { ComponentPropsWithoutRef, ComponentProps } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DashboardThread } from "./dashboard-model";

import { DashboardOverview } from "./dashboard-overview";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params: _params,
    search: _search,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    params?: unknown;
    search?: unknown;
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/areas/components/area-quick-panel", () => {
  return {
    AreaQuickPanel: ({
      area,
      children,
      onNewThread,
    }: {
      area: { condition: string; id: string; name: string };
      children: React.ReactNode;
      onNewThread: (areaId: string) => void;
    }) => (
      <button
        type="button"
        aria-label={`Area panel for ${area.name}`}
        title={
          area.condition === "healthy" ? `${area.name} — steady` : area.name
        }
        onClick={() => onNewThread(area.id)}
      >
        {children}
      </button>
    ),
  };
});

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

type OverviewProps = ComponentProps<typeof DashboardOverview>;

function renderOverview(overrides: Partial<OverviewProps> = {}) {
  const props: OverviewProps = {
    areas: [
      {
        id: "health",
        name: "Health",
        slug: "health",
        icon: "HeartPulse",
        condition: "critical",
        order: 0,
      },
      {
        id: "home",
        name: "Home",
        slug: "home",
        icon: "Home",
        condition: "healthy",
        order: 1,
      },
    ],
    threads: [],
    tasks: [],
    currentDate,
    onCreateArea: vi.fn(),
    onNewThreadInArea: vi.fn(),
    ...overrides,
  };
  return { ...render(<DashboardOverview {...props} />), props };
}

describe("DashboardOverview", () => {
  it("keeps attention-bearing Areas prominent in the status bar", () => {
    renderOverview({
      threads: [thread("Insurance appeal", { nextMove: "Call the clinic" })],
    });

    // The page's only heading is the one assistive tech reads.
    expect(
      screen.getByRole("heading", { level: 1, name: "Life Areas" }),
    ).toBeInTheDocument();

    const bar = screen.getByRole("region", {
      name: "Life Areas by condition",
    });

    const attention = within(bar).getByTitle("Health");
    expect(attention).toBeVisible();
    expect(attention).toHaveTextContent("Health");
    expect(attention).toHaveTextContent("Call the clinic");

    const healthyGlyph = within(bar).getByRole("button", {
      name: "Area panel for Home",
    });
    expect(within(healthyGlyph).getByText("Home")).toHaveClass("sr-only");
    expect(healthyGlyph).toHaveAttribute("title", "Home — steady");
    expect(healthyGlyph).not.toHaveTextContent("Call the clinic");

    expect(
      attention.compareDocumentPosition(healthyGlyph) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("collapses to a steady line when every Area is healthy", () => {
    renderOverview({
      areas: [
        {
          id: "health",
          name: "Health",
          slug: "health",
          icon: "HeartPulse",
          condition: "healthy",
          order: 0,
        },
        {
          id: "home",
          name: "Home",
          slug: "home",
          icon: "Home",
          condition: "healthy",
          order: 1,
        },
      ],
    });

    const bar = screen.getByRole("region", {
      name: "Life Areas by condition",
    });
    expect(within(bar).getByText("All 2 areas steady")).toBeVisible();

    // Only the two quiet glyphs are left — no reason group to read.
    const buttons = within(bar).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("title"))).toEqual([
      "Health — steady",
      "Home — steady",
    ]);
  });

  it("lays every Thread out in canonical attention order", () => {
    renderOverview({
      threads: [
        thread("Plain open", { order: 0 }),
        thread("Next move", { nextMove: "Call", order: 1 }),
        thread("Upcoming", { followUp: currentDate + 86_400_000 }),
        thread("Overdue", { followUp: currentDate - 86_400_000 }),
      ],
    });

    const rows = within(
      screen.getByRole("list", { name: "Threads in attention order" }),
    ).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Overdue"),
      expect.stringContaining("Upcoming"),
      expect.stringContaining("Next move"),
      expect.stringContaining("Plain open"),
    ]);
  });

  it("keeps dated Inbox Tasks visible without mixing them into the Thread run", () => {
    renderOverview({
      tasks: [
        {
          id: "dated",
          text: "Renew passport",
          createdAt: currentDate,
          when: currentDate,
        },
        { id: "loose", text: "Buy stamps", createdAt: currentDate },
      ],
    });

    const synopsis = screen.getByRole("region", { name: "Inbox synopsis" });
    expect(within(synopsis).getByText("Renew passport")).toBeVisible();
    expect(within(synopsis).getByText("+1 more")).toBeVisible();
    expect(within(synopsis).getByText(/2 open/)).toBeVisible();
  });

  it("describes a long-quiet Thread without fading it or changing its order", () => {
    renderOverview({
      threads: [
        thread("Quiet concern", {
          lastActivityAt: currentDate - 45 * 86_400_000,
        }),
      ],
    });

    const row = screen.getByRole("link", { name: /Quiet concern/ });
    expect(row).toHaveTextContent("quiet 45d");
    expect(row.className).not.toMatch(/opacity/);
  });

  it("preserves Area onboarding until the first Area exists", async () => {
    const user = userEvent.setup();
    const onCreateArea = vi.fn();
    const { rerender, props } = renderOverview({ areas: [], onCreateArea });

    await user.click(screen.getByRole("button", { name: "Create Life Area" }));
    expect(onCreateArea).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("list", { name: "Threads in attention order" }),
    ).toBeNull();

    rerender(
      <DashboardOverview
        {...props}
        areas={[
          {
            id: "health",
            name: "Health",
            slug: "health",
            icon: "HeartPulse",
            condition: "critical",
            order: 0,
          },
        ]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Create Life Area" }),
    ).toBeNull();
    expect(screen.getByText("No open Threads right now.")).toBeVisible();
  });
});
