import type { AreaSummary, Note, Thread } from "@vita-os/contracts";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DashboardOverview } from "./dashboard-overview";

// A link's search is a function of the current one; starting from none, its
// result is where the link goes.
function hrefOf(to: string, search: unknown) {
  if (typeof search !== "function") return to;
  const next = (search as (previous: object) => Record<string, unknown>)({});
  const query = Object.entries(next)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return query === "" ? to : `${to}?${query}`;
}

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params: _params,
    search,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    params?: unknown;
    search?: unknown;
    to: string;
  }) => (
    <a href={hrefOf(to, search)} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

// The cards' writes belong to the hooks; this suite is about what lands where.
vi.mock("../../threads/use-complete-next-move", () => ({
  useCompleteNextMove: () => vi.fn(),
}));
vi.mock("../../threads/use-update-thread", () => ({
  useUpdateThread: () => vi.fn(),
}));
vi.mock("../../notes/use-complete-note", () => ({
  useCompleteNote: () => vi.fn(),
}));
vi.mock("../../notes/use-update-note-body", () => ({
  useUpdateNoteBody: () => vi.fn(),
}));
vi.mock("../../notes/use-update-note-when", () => ({
  useUpdateNoteWhen: () => vi.fn(),
}));

const isMobile = vi.hoisted(() => ({ value: false }));
vi.mock("../../hooks/use-mobile", () => ({
  useIsMobile: () => isMobile.value,
  useIsCompact: () => isMobile.value,
}));

const currentDate = new Date(2026, 6, 17, 12).getTime();
const DAY = 86_400_000;

function thread(title: string, fields: Partial<Thread> = {}): Thread {
  return {
    _id: title as Thread["_id"],
    title,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    areaId: "health" as Thread["areaId"],
    order: 0,
    state: "open",
    revision: 0,
    createdAt: currentDate,
    ...fields,
  } as Thread;
}

function note(body: string, fields: Partial<Note> = {}): Note {
  return {
    _id: body as Note["_id"],
    body,
    state: "open",
    revision: 0,
    createdAt: currentDate,
    ...fields,
  } as Note;
}

const areas = [
  {
    _id: "health",
    name: "Health",
    slug: "health",
    icon: "HeartPulse",
    order: 0,
  },
  {
    _id: "home",
    name: "Home",
    slug: "home",
    icon: "Home",
    order: 1,
  },
] as unknown as AreaSummary[];

type OverviewProps = ComponentProps<typeof DashboardOverview>;

function renderOverview(overrides: Partial<OverviewProps> = {}) {
  const props: OverviewProps = {
    areas,
    threads: [],
    notes: [],
    currentDate,
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
  it("needs no Area to show the board, and offers no filter without one", () => {
    renderOverview({
      areas: [],
      threads: [thread("Unlabeled", { areaId: undefined })],
    });

    expect(screen.getByText("Unlabeled")).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Filter by area" }),
    ).not.toBeInTheDocument();
  });

  it("offers All, each Area with its count, and No area, each as a link", () => {
    renderOverview({
      threads: [
        thread("Checkup"),
        thread("Dentist", { order: 1 }),
        thread("Passport", { areaId: undefined, order: 2 }),
      ],
    });

    const row = screen.getByRole("navigation", { name: "Filter by area" });
    expect(
      within(row)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["All3", "/"],
      ["Health2", "/?area=health"],
      ["Home0", "/?area=home"],
      ["No area1", "/?area=none"],
    ]);
    expect(within(row).getByRole("link", { name: /All/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("narrows the board to one Area and leaves Standalone Notes out", () => {
    renderOverview({
      areaFilter: "home",
      threads: [
        thread("Checkup", { followUp: currentDate }),
        thread("Fix the gate", {
          areaId: "home" as Thread["areaId"],
          followUp: currentDate,
          order: 1,
        }),
      ],
      notes: [note("Water the plants", { attentionDate: currentDate })],
    });

    expect(columnText("Now")).toEqual([
      expect.stringContaining("Fix the gate"),
    ]);
    expect(
      screen.queryByDisplayValue("Water the plants"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows only unlabeled Threads under No area", () => {
    renderOverview({
      areaFilter: "none",
      threads: [
        thread("Checkup", { followUp: currentDate }),
        thread("Passport", {
          areaId: undefined,
          followUp: currentDate,
          order: 1,
        }),
      ],
    });

    expect(columnText("Now")).toEqual([expect.stringContaining("Passport")]);
  });

  it("falls back to the whole board for an Area that is not there", () => {
    renderOverview({
      areaFilter: "deleted-area",
      threads: [thread("Checkup", { followUp: currentDate })],
      notes: [note("Water the plants", { attentionDate: currentDate })],
    });

    expect(screen.getByText("Checkup")).toBeVisible();
    expect(screen.getByDisplayValue("Water the plants")).toBeVisible();
  });

  it("says when a filtered Area has nothing open", () => {
    renderOverview({ areaFilter: "home", threads: [thread("Checkup")] });

    expect(screen.getByText("Nothing open in Home.")).toBeVisible();
  });

  it("tags a labeled Thread's card with its Area and leaves an unlabeled one bare", () => {
    renderOverview({
      threads: [
        thread("Checkup", { followUp: currentDate }),
        thread("Passport", {
          areaId: undefined,
          followUp: currentDate,
          order: 1,
        }),
      ],
    });

    const [labeled, unlabeled] = within(
      screen.getByRole("region", { name: "Now" }),
    ).getAllByRole("listitem");
    expect(within(labeled!).getByTitle("Health")).toHaveTextContent("Health");
    expect(within(unlabeled!).queryByTitle("Health")).not.toBeInTheDocument();
    expect(within(unlabeled!).queryByTitle("Home")).not.toBeInTheDocument();
  });

  it("states each lane's count on the lane", () => {
    renderOverview({
      threads: [
        thread("Late one", { followUp: currentDate - DAY }),
        thread("Also late", { followUp: currentDate - DAY, order: 1 }),
        thread("Midweek", { followUp: currentDate + 2 * DAY, order: 2 }),
      ],
    });

    const now = screen.getByRole("region", { name: "Now" });
    expect(within(now).getByText("2")).toBeVisible();
    const week = screen.getByRole("region", { name: "This week" });
    expect(within(week).getByText("1")).toBeVisible();
  });

  it("puts dated Threads and Notes in the column their date earns", () => {
    renderOverview({
      threads: [
        thread("Overdue", { followUp: currentDate - DAY }),
        thread("Midweek", { followUp: currentDate + 2 * DAY, order: 1 }),
        thread("Distant", { followUp: currentDate + 30 * DAY, order: 2 }),
      ],
      notes: [note("Water the plants", { attentionDate: currentDate })],
    });

    const now = screen.getByRole("region", { name: "Now" });
    expect(within(now).getByText("Overdue")).toBeVisible();
    expect(within(now).getByDisplayValue("Water the plants")).toBeVisible();
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
    expect(within(margin).getByDisplayValue("Loose thought")).toBeVisible();
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
