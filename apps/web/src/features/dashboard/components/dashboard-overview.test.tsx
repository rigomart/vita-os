import type {
  ProjectedArea,
  ProjectedNote,
  ProjectedThread,
} from "@convex/lib/validators";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
      title={`${area.name} — ${area.condition}`}
      onClick={() => onNewThread(area.id)}
    >
      {children}
    </button>
  ),
}));

// The cards' writes belong to the hooks; this suite is about what lands where.
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

const isMobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile.value,
  useIsCompact: () => isMobile.value,
}));

const currentDate = new Date(2026, 6, 17, 12).getTime();
const DAY = 86_400_000;

function thread(
  title: string,
  fields: Partial<ProjectedThread> = {},
): ProjectedThread {
  return {
    _id: title as ProjectedThread["_id"],
    title,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    areaId: "health" as ProjectedThread["areaId"],
    order: 0,
    state: "open",
    createdAt: currentDate,
    ...fields,
  } as ProjectedThread;
}

function note(
  body: string,
  fields: Partial<ProjectedNote> = {},
): ProjectedNote {
  return {
    _id: body as ProjectedNote["_id"],
    _creationTime: currentDate,
    body,
    state: "open",
    createdAt: currentDate,
    ...fields,
  } as ProjectedNote;
}

const areas = [
  {
    _id: "health",
    name: "Health",
    slug: "health",
    icon: "HeartPulse",
    condition: "critical",
    order: 0,
  },
  {
    _id: "home",
    name: "Home",
    slug: "home",
    icon: "Home",
    condition: "healthy",
    order: 1,
  },
] as unknown as ProjectedArea[];

type OverviewProps = ComponentProps<typeof DashboardOverview>;

function renderOverview(overrides: Partial<OverviewProps> = {}) {
  const props: OverviewProps = {
    areas,
    threads: [],
    notes: [],
    currentDate,
    onCreateArea: vi.fn(),
    onNewThreadInArea: vi.fn(),
    ...overrides,
  };
  return { ...render(<DashboardOverview {...props} />), props };
}

function columnText(name: string) {
  return within(screen.getByRole("region", { name }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("DashboardOverview", () => {
  it("offers the first Area when there are none", async () => {
    const { props } = renderOverview({ areas: [] });

    await userEvent.click(
      screen.getByRole("button", { name: "Create Life Area" }),
    );
    expect(props.onCreateArea).toHaveBeenCalled();
  });

  it("sorts the Areas worst condition first and captures into one", async () => {
    const { props } = renderOverview();

    const bar = screen.getByRole("region", { name: "Life Areas by condition" });
    const buttons = within(bar).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Area panel for Health",
      "Area panel for Home",
    ]);

    await userEvent.click(buttons[0]!);
    expect(props.onNewThreadInArea).toHaveBeenCalledWith("health");
  });

  it("counts each Area's share of the board", () => {
    renderOverview({
      threads: [
        thread("Late one", { followUp: currentDate - DAY }),
        thread("Elsewhere", {
          areaId: "home" as ProjectedThread["areaId"],
          order: 1,
        }),
      ],
    });

    const bar = screen.getByRole("region", { name: "Life Areas by condition" });
    expect(
      within(bar).getByRole("button", { name: "Area panel for Health" }),
    ).toHaveTextContent("1");
  });

  it("puts dated Threads and Notes in the column their date earns", () => {
    renderOverview({
      threads: [
        thread("Overdue", { followUp: currentDate - DAY }),
        thread("Midweek", { followUp: currentDate + 2 * DAY, order: 1 }),
        thread("Distant", { followUp: currentDate + 30 * DAY, order: 2 }),
      ],
      notes: [note("Water the plants", { when: currentDate })],
    });

    expect(columnText("Now")).toEqual([
      expect.stringContaining("Overdue"),
      expect.stringContaining("Water the plants"),
    ]);
    expect(columnText("This week")).toEqual([
      expect.stringContaining("Midweek"),
    ]);
    expect(columnText("Later")).toEqual([expect.stringContaining("Distant")]);
  });

  /**
   * #236, settled: a Follow-up outranks an undated Next Move, so an actionable
   * Thread with no date keeps its own run in the margin rather than in Now.
   */
  it("keeps undated Next Moves out of Now and in the No date margin", () => {
    renderOverview({
      threads: [
        thread("Dated", { followUp: currentDate }),
        thread("Actionable", { nextMove: "Call the clinic", order: 1 }),
        thread("Idle", { order: 2 }),
      ],
      notes: [note("Loose thought")],
    });

    expect(columnText("Now")).toEqual([expect.stringContaining("Dated")]);

    // The margin is an <aside>, so it lands as a complementary landmark.
    const margin = screen.getByRole("complementary", { name: "No date" });
    expect(within(margin).getByText("Ready to move")).toBeVisible();
    // The move leads the card; the Thread's own name sits under it.
    expect(within(margin).getByText("Call the clinic")).toBeVisible();
    expect(within(margin).getByText("Actionable")).toBeVisible();
    expect(within(margin).getByText("Idle")).toBeVisible();
    expect(within(margin).getByText("Loose thought")).toBeVisible();
  });

  it("folds Later and the No date margin on a phone", async () => {
    isMobile.value = true;
    try {
      renderOverview({
        threads: [
          thread("Overdue", { followUp: currentDate - DAY }),
          thread("Distant", { followUp: currentDate + 30 * DAY, order: 1 }),
          thread("Actionable", { nextMove: "Call the clinic", order: 2 }),
        ],
      });

      expect(columnText("Now")).toEqual([expect.stringContaining("Overdue")]);
      expect(screen.queryByText("Distant")).not.toBeInTheDocument();
      expect(screen.queryByText("Call the clinic")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Later/ }));
      expect(screen.getByText("Distant")).toBeVisible();

      await userEvent.click(screen.getByRole("button", { name: /No date/ }));
      expect(screen.getByText("Call the clinic")).toBeVisible();
    } finally {
      isMobile.value = false;
    }
  });

  it("says so plainly when nothing is asking", () => {
    renderOverview();

    expect(screen.getByText("Nothing is asking for you.")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Now" }),
    ).not.toBeInTheDocument();
  });
});
