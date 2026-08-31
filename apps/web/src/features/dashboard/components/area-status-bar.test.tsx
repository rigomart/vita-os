import type { ComponentPropsWithoutRef, ComponentProps } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DashboardArea, DashboardThread } from "./dashboard-model";

import { AreaStatusBar } from "./area-status-bar";

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

vi.mock("@/features/areas/components/area-quick-panel", () => ({
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
      title={area.condition === "healthy" ? `${area.name} — steady` : area.name}
      onClick={() => onNewThread(area.id)}
    >
      {children}
    </button>
  ),
}));

const currentDate = new Date(2026, 6, 17, 12).getTime();

/** Offset in whole days from "today", at an hour the day boundary can't blur. */
const day = (offset: number) => new Date(2026, 6, 17 + offset, 9).getTime();

function area(
  name: string,
  fields: Partial<DashboardArea> = {},
): DashboardArea {
  return {
    id: name,
    name,
    slug: name.toLowerCase(),
    icon: "Compass",
    condition: "needs_attention",
    order: 0,
    ...fields,
  };
}

function thread(
  id: string,
  fields: Partial<DashboardThread> = {},
): DashboardThread {
  return {
    id,
    title: id,
    slug: id,
    areaId: "Health",
    order: 0,
    ...fields,
  };
}

type BarProps = ComponentProps<typeof AreaStatusBar>;

/** Renders the bar and hands back the region every assertion scopes to. */
function renderBar(overrides: Partial<BarProps> = {}) {
  const props: BarProps = {
    areas: [area("Health", { condition: "critical" })],
    threads: [],
    currentDate,
    onNewThreadInArea: vi.fn(),
    ...overrides,
  };
  render(<AreaStatusBar {...props} />);
  return screen.getByRole("region", { name: "Life Areas by condition" });
}

/** An attention Area's group is titled with the bare Area name. */
function reasonGroup(name: string) {
  return screen.getByTitle(name);
}

describe("AreaStatusBar", () => {
  it("leads with today's date", () => {
    const bar = renderBar();

    const stamp = within(bar).getByTitle("Friday, July 17, 2026");
    expect(stamp).toHaveTextContent("Fri · Jul 17");
    expect(stamp).toHaveAttribute(
      "dateTime",
      new Date(currentDate).toISOString(),
    );
  });

  it("reads the soonest follow-up ahead of every other signal", () => {
    renderBar({
      threads: [
        thread("Book scan", {
          followUp: day(3),
          nextMove: "Book the scan",
          order: 0,
        }),
        thread("Refill", {
          followUp: day(1),
          nextMove: "Refill the script",
          lastActivityAt: day(0),
          lastActivityContent: "Clinic sent the report",
          order: 1,
        }),
      ],
    });

    expect(reasonGroup("Health")).toHaveTextContent(
      "Tomorrow · Refill the script",
    );
    expect(reasonGroup("Health")).not.toHaveTextContent("Book the scan");
    expect(reasonGroup("Health")).not.toHaveTextContent(
      "Clinic sent the report",
    );
  });

  it("names the dated Thread when it carries no next move", () => {
    renderBar({
      threads: [thread("Insurance appeal", { followUp: day(0) })],
    });

    expect(reasonGroup("Health")).toHaveTextContent("Today · Insurance appeal");
  });

  it("flags an overdue follow-up as late", () => {
    renderBar({
      threads: [
        thread("Insurance appeal", {
          followUp: day(-1),
          nextMove: "Call the clinic",
        }),
      ],
    });

    const due = within(reasonGroup("Health")).getByText("Late · Jul 16");
    expect(due).toHaveClass("text-condition-critical");
  });

  it("leaves a follow-up that is still ahead unflagged", () => {
    renderBar({ threads: [thread("Insurance appeal", { followUp: day(0) })] });

    const due = within(reasonGroup("Health")).getByText("Today");
    expect(due).not.toHaveClass("text-condition-critical");
  });

  it("falls back to the first Thread's next move when nothing is dated", () => {
    renderBar({
      threads: [
        thread("Later", { nextMove: "Later move", order: 2 }),
        thread("Appeal", { nextMove: "Call the clinic", order: 1 }),
        thread("Quiet", {
          lastActivityAt: day(0),
          lastActivityContent: "Clinic sent the report",
          order: 0,
        }),
      ],
    });

    expect(reasonGroup("Health")).toHaveTextContent("Call the clinic");
    expect(reasonGroup("Health")).not.toHaveTextContent("Later move");
    expect(reasonGroup("Health")).not.toHaveTextContent(
      "Clinic sent the report",
    );
  });

  it("falls back to the newest activity when nothing is dated or moved", () => {
    renderBar({
      threads: [
        thread("Old", {
          lastActivityAt: day(-3),
          lastActivityContent: "Old note",
        }),
        thread("New", {
          lastActivityAt: day(0),
          lastActivityContent: "Clinic sent the report",
        }),
      ],
    });

    expect(reasonGroup("Health")).toHaveTextContent("Clinic sent the report");
    expect(reasonGroup("Health")).not.toHaveTextContent("Old note");
  });

  it("says nothing is captured when the Area has no Threads to speak for it", () => {
    renderBar();

    const reason = within(reasonGroup("Health")).getByText("Nothing captured");
    expect(reason).toHaveClass("italic");
  });

  it("puts critical Areas ahead of the ones that only need attention", () => {
    const bar = renderBar({
      areas: [
        area("Home", { condition: "needs_attention", order: 0 }),
        area("Money", { condition: "needs_attention", order: 2 }),
        area("Health", { condition: "critical", order: 3 }),
      ],
    });

    expect(
      within(bar)
        .getAllByRole("button")
        .map((button) => button.getAttribute("title")),
    ).toEqual(["Health", "Home", "Money"]);
  });

  it("caps the reasons at four and counts the rest", () => {
    const bar = renderBar({
      areas: ["Health", "Home", "Money", "Work", "Family", "Learning"].map(
        (name, index) => area(name, { order: index }),
      ),
    });

    expect(
      within(bar)
        .getAllByRole("button")
        .map((button) => button.getAttribute("title")),
    ).toEqual(["Health", "Home", "Money", "Work"]);

    const overflow = within(bar).getByText("+2 more");
    expect(overflow).toHaveAttribute("title", "Family, Learning");
  });

  it("collapses to one steady line when every Area is healthy", () => {
    const bar = renderBar({
      areas: [
        area("Health", { condition: "healthy", order: 0 }),
        area("Home", { condition: "healthy", order: 1 }),
        area("Money", { condition: "healthy", order: 2 }),
      ],
    });

    expect(within(bar).getByText("All 3 areas steady")).toBeVisible();
    expect(within(bar).queryByText("Nothing captured")).toBeNull();
    expect(within(bar).getAllByRole("button")).toHaveLength(3);
  });

  it("trails healthy Areas as icon-only links in Area order", () => {
    const bar = renderBar({
      areas: [
        area("Money", { condition: "healthy", order: 2 }),
        area("Home", { condition: "healthy", order: 1 }),
        area("Health", { condition: "critical", order: 0 }),
      ],
      threads: [thread("Appeal", { nextMove: "Call the clinic" })],
    });

    const glyphs = within(bar).getAllByRole("button", {
      name: /Area panel for (Home|Money)/,
    });
    expect(glyphs.map((link) => link.getAttribute("title"))).toEqual([
      "Home — steady",
      "Money — steady",
    ]);
    for (const glyph of glyphs) {
      // Nothing but the icon and the name assistive tech needs.
      expect(within(glyph).getByText(/Home|Money/)).toHaveClass("sr-only");
    }

    expect(glyphs[0]).not.toHaveTextContent("Nothing captured");
    expect(
      reasonGroup("Health").compareDocumentPosition(glyphs[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("summons Area capture from the Condition strip", async () => {
    const user = userEvent.setup();
    const onNewThreadInArea = vi.fn();
    renderBar({ onNewThreadInArea });

    await user.click(
      screen.getByRole("button", { name: "Area panel for Health" }),
    );

    expect(onNewThreadInArea).toHaveBeenCalledWith("Health");
  });
});
