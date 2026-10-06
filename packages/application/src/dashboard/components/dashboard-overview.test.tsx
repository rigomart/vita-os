import type { AreaSummary, TaskId, Note, Thread } from "@vita-os/contracts";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { describe, expect, it, vi } from "vitest";

import { createFeedbackMock } from "../../test/render-with-providers";
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
    activeOptions: _activeOptions,
    search,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    params?: unknown;
    activeOptions?: unknown;
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
vi.mock("../../threads/use-tasks", () => ({
  useCompleteTask: () => vi.fn(),
  useSkipTask: () => vi.fn(),
  useTaskDates: () => ({
    setDate: vi.fn(),
    setRepeat: vi.fn(),
    addFollowUp: vi.fn(),
  }),
  useConversionLock: () => ({ locked: false, pendingTaskIds: new Set() }),
}));
vi.mock("../../threads/use-update-thread", () => ({
  useUpdateThread: () => vi.fn(),
}));
vi.mock("../../notes/use-archive-note", () => ({
  useArchiveNote: () => vi.fn(),
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
/** Today as the pickers store a date alone: local midnight. */
const today = new Date(2026, 6, 17).getTime();
const DAY = 86_400_000;

function tasks(...texts: string[]) {
  return texts.map((text) => ({ _id: text as TaskId, text }));
}

function dated(text: string, date: number) {
  return { _id: text as TaskId, text, date };
}

/**
 * `followUp` reads as "the date this Thread comes back": the Thread holds a
 * Task with that date, which is all that places a Thread.
 */
function thread(
  title: string,
  { followUp, ...fields }: Partial<Thread> & { followUp?: number } = {},
): Thread {
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
    ...(followUp === undefined
      ? {}
      : {
          tasks: [
            ...(fields.tasks ?? []),
            {
              _id: `due-${title}` as TaskId,
              text: "Follow up",
              date: followUp,
            },
          ],
        }),
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
  return {
    ...render(
      <FeedbackProvider feedback={createFeedbackMock()}>
        <DashboardOverview {...props} />
      </FeedbackProvider>,
    ),
    props,
  };
}

function card(title: string) {
  const link = screen.getByRole("link", { name: title });
  const root = link.closest("li");
  if (!(root instanceof HTMLElement)) throw new Error("No card");
  return root;
}

function columnText(name: string) {
  return within(screen.getByRole("region", { name }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("DashboardOverview", () => {
  it("needs no Area to show the board, and still offers All and Notes without one", () => {
    renderOverview({
      areas: [],
      threads: [thread("Unlabeled", { areaId: undefined })],
      notes: [note("Water the plants")],
    });

    expect(screen.getByText("Unlabeled")).toBeVisible();
    const row = screen.getByRole("navigation", { name: "Filter the board" });
    expect(
      within(row)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["All1", "Notes1"]);
  });

  it("offers Manage areas beside the Areas, before Notes", () => {
    renderOverview();

    const row = screen.getByRole("navigation", { name: "Filter the board" });
    const manage = within(row).getByRole("button", { name: "Manage areas" });
    const notes = within(row).getByRole("link", { name: /Notes/ });
    expect(
      manage.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("offers All, each Area with its count, No area, and Notes, each as a link", () => {
    renderOverview({
      threads: [
        thread("Checkup"),
        thread("Dentist", { order: 1 }),
        thread("Passport", { areaId: undefined, order: 2 }),
      ],
      notes: [note("Water the plants"), note("Call the bank")],
    });

    const row = screen.getByRole("navigation", { name: "Filter the board" });
    expect(
      within(row)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["All3", "/"],
      ["Health2", "/?area=health"],
      ["Home0", "/?area=home"],
      ["No area1", "/?area=none"],
      ["Notes2", "/?show=notes"],
    ]);
    expect(within(row).getByRole("link", { name: /All/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("narrows the board to one Area and leaves Standalone Notes out", () => {
    renderOverview({
      filter: { area: "home" },
      threads: [
        thread("Checkup", { followUp: today }),
        thread("Fix the gate", {
          areaId: "home" as Thread["areaId"],
          followUp: today,
          order: 1,
        }),
      ],
      notes: [note("Water the plants", { followUp: today })],
    });

    expect(columnText("Now")).toEqual([
      expect.stringContaining("Fix the gate"),
    ]);
    expect(
      screen.queryByRole("button", { name: "Open note: Water the plants" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows only unlabeled Threads under No area", () => {
    renderOverview({
      filter: { area: "none" },
      threads: [
        thread("Checkup", { followUp: today }),
        thread("Passport", {
          areaId: undefined,
          followUp: today,
          order: 1,
        }),
      ],
    });

    expect(columnText("Now")).toEqual([expect.stringContaining("Passport")]);
  });

  it("falls back to the whole board for an Area that is not there", () => {
    renderOverview({
      filter: { area: "deleted-area" },
      threads: [thread("Checkup", { followUp: today })],
      notes: [note("Water the plants", { followUp: today })],
    });

    expect(screen.getByText("Checkup")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Open note: Water the plants" }),
    ).toBeVisible();
  });

  it("says when a filtered Area has nothing open", () => {
    renderOverview({ filter: { area: "home" }, threads: [thread("Checkup")] });

    expect(screen.getByText("Nothing open in Home.")).toBeVisible();
  });

  it("shows only Notes under the Notes filter, dated in columns and undated in the margin", () => {
    renderOverview({
      filter: { show: "notes" },
      threads: [
        thread("Checkup", { followUp: today }),
        thread("Passport", { areaId: undefined, order: 1 }),
      ],
      notes: [
        note("Water the plants", { followUp: today }),
        note("Idea for the garden"),
      ],
    });

    expect(columnText("Now")).toEqual([
      expect.stringContaining("Water the plants"),
    ]);
    expect(screen.queryByText("Checkup")).not.toBeInTheDocument();
    expect(screen.queryByText("Passport")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open note: Idea for the garden" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Notes/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("says when no Note is open under the Notes filter", () => {
    renderOverview({
      filter: { show: "notes" },
      threads: [thread("Checkup")],
    });

    expect(screen.getByText("No Note is asking for you.")).toBeVisible();
  });

  it("tags a labeled Thread's card with its Area and leaves an unlabeled one bare", () => {
    renderOverview({
      threads: [
        thread("Checkup", { followUp: today }),
        thread("Passport", {
          areaId: undefined,
          followUp: today,
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
        thread("Late one", { followUp: today - DAY }),
        thread("Also late", { followUp: today - DAY, order: 1 }),
        thread("Midweek", { followUp: today + 2 * DAY, order: 2 }),
      ],
    });

    const laneHeading = (name: string) =>
      within(screen.getByRole("region", { name })).getByRole("heading", {
        level: 2,
      });
    expect(laneHeading("Now")).toHaveTextContent(/^Now2/);
    expect(laneHeading("This week")).toHaveTextContent(/^This week1/);
  });

  it("puts dated Threads and Notes in the column their date earns", async () => {
    renderOverview({
      threads: [
        thread("Overdue", { followUp: today - DAY }),
        thread("Midweek", { followUp: today + 2 * DAY, order: 1 }),
        thread("Distant", { followUp: today + 30 * DAY, order: 2 }),
      ],
      notes: [note("Water the plants", { followUp: today })],
    });

    const now = screen.getByRole("region", { name: "Now" });
    expect(within(now).getByText("Overdue")).toBeVisible();
    expect(
      within(now).getByRole("button", { name: "Open note: Water the plants" }),
    ).toBeVisible();
    expect(columnText("This week")).toEqual([
      expect.stringContaining("Midweek"),
    ]);
    await userEvent.click(screen.getByRole("button", { name: /Later/ }));
    expect(columnText("Later")).toEqual([expect.stringContaining("Distant")]);
  });

  it("starts Later folded, saying how many wait there and when the next arrives", async () => {
    renderOverview({
      threads: [
        thread("Distant", { followUp: today + 30 * DAY }),
        thread("Further", { followUp: today + 40 * DAY, order: 1 }),
      ],
    });

    const fold = screen.getByRole("button", { name: /Later/ });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(fold).toHaveTextContent(/^Later2next Aug 16/);
    expect(screen.queryByText("Distant")).not.toBeInTheDocument();
    // The rail's horizon names each item on hover, and only on hover.
    expect(
      [...fold.querySelectorAll("[data-label]")].map((mark) =>
        mark.getAttribute("data-label"),
      ),
    ).toEqual(["Distant · Aug 16", "Further · Aug 26"]);

    await userEvent.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Distant")).toBeVisible();
    expect(fold).toHaveTextContent("Dated beyond this week");

    await userEvent.click(fold);
    expect(screen.queryByText("Distant")).not.toBeInTheDocument();
  });

  it("heads each column's runs with when they come due, and leaves an exact day to its heading", () => {
    renderOverview({
      threads: [
        thread("Overdue", { followUp: today - 3 * DAY }),
        thread("Dentist", { followUp: today }),
        thread("Tomorrow one", { followUp: today + DAY, order: 1 }),
        thread("Sunday one", { followUp: today + 2 * DAY, order: 2 }),
        thread("Sunday two", { followUp: today + 2 * DAY, order: 3 }),
      ],
    });

    const group = (lane: string, name: string) =>
      within(screen.getByRole("region", { name: lane })).getByRole("region", {
        name,
      });

    // A late card keeps its own date: "Late" says only that it slipped.
    expect(group("Now", "Late")).toHaveTextContent("Late1");
    expect(within(group("Now", "Late")).getByText("−3d")).toBeVisible();
    // Only the heading says Today; the card under it carries no token.
    expect(within(group("Now", "Today")).getAllByText(/Today/)).toHaveLength(1);

    const tomorrow = group("This week", "Tomorrow");
    expect(tomorrow).toHaveTextContent(/^Tomorrow1Saturday/);
    expect(within(tomorrow).queryByText("Sat")).not.toBeInTheDocument();
    // The date still opens from the card, as a control rather than a token.
    expect(
      within(tomorrow).getByRole("button", { name: "Change date" }),
    ).toBeInTheDocument();

    const sunday = group("This week", "Sunday");
    expect(sunday).toHaveTextContent(/^Sunday22d/);
    expect(within(sunday).getAllByRole("listitem")).toHaveLength(2);
  });

  it("orders a day by time and gives a timed card only its time under a day's heading", () => {
    renderOverview({
      threads: [
        thread("Afternoon call", { followUp: today + 15 * 3_600_000 }),
        thread("Sometime today", { followUp: today, order: 1 }),
        thread("Late timed", {
          followUp: today - 2 * DAY + 9.5 * 3_600_000,
          order: 2,
        }),
      ],
    });

    const now = screen.getByRole("region", { name: "Now" });
    const todayGroup = within(now).getByRole("region", { name: "Today" });
    const titles = within(todayGroup)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(titles).toEqual(["Sometime today", "Afternoon call"]);
    expect(within(todayGroup).getByText("3 PM")).toBeVisible();
    expect(
      within(within(now).getByRole("region", { name: "Late" })).getByText(
        "−2d · 9:30 AM",
      ),
    ).toBeVisible();
  });

  /**
   * #236, settled: a Follow-up outranks undated Tasks, so an actionable
   * Thread with no date keeps its own run in the margin rather than in Now.
   */
  it("keeps undated Tasks out of Now and in the No date margin", () => {
    renderOverview({
      threads: [
        thread("Dated", { followUp: today }),
        thread("Actionable", { tasks: tasks("Call the clinic"), order: 1 }),
        thread("Idle", { order: 2 }),
      ],
      notes: [note("Loose thought")],
    });

    expect(columnText("Now")).toEqual([expect.stringContaining("Dated")]);

    // The margin is an <aside>, so it lands as a complementary landmark.
    const margin = screen.getByRole("complementary", { name: "No date" });
    expect(within(margin).getByText("Ready to move")).toBeVisible();
    // The Thread's name heads the card; its only Task sits under it.
    expect(within(margin).getByText("Call the clinic")).toBeVisible();
    expect(within(margin).getByText("Actionable")).toBeVisible();
    expect(within(margin).getByText("Idle")).toBeVisible();
    expect(
      within(margin).getByRole("button", { name: "Open note: Loose thought" }),
    ).toBeVisible();
  });

  it("places a Thread by its soonest dated Task, and only undated Tasks make it Ready to move", () => {
    renderOverview({
      threads: [
        thread("Soon", {
          tasks: [dated("Far", today + 30 * DAY), dated("Near", today + DAY)],
        }),
        thread("Far only", {
          tasks: [dated("Far", today + 30 * DAY)],
          order: 1,
        }),
        thread("Mixed", {
          tasks: [...tasks("Undated"), dated("Today", today)],
          order: 2,
        }),
        thread("Undated only", { tasks: tasks("A", "B"), order: 3 }),
        thread("Bare", { order: 4 }),
      ],
    });

    expect(columnText("Now")).toEqual([expect.stringContaining("Mixed")]);
    expect(columnText("This week")).toEqual([expect.stringContaining("Soon")]);
    const later = screen.getByRole("region", { name: "Later" });
    expect(later).toHaveTextContent("1");
    const margin = screen.getByRole("complementary", { name: "No date" });
    const ready = within(margin).getByRole("region", { name: "Ready to move" });
    expect(ready).toHaveTextContent("Undated only");
    expect(ready).not.toHaveTextContent("Mixed");
    expect(
      within(within(margin).getByRole("region", { name: "Open" })).getByText(
        "Bare",
      ),
    ).toBeVisible();
  });

  it("leads a time column's card with the dated Task that placed it, even beside a focused one", () => {
    renderOverview({
      threads: [
        thread("Checkup", {
          tasks: [
            ...tasks("Pick a clinic"),
            dated("Book the scan", today + 2 * DAY),
          ],
          focusedTaskId: "Pick a clinic" as TaskId,
        }),
      ],
    });

    const checkup = within(card("Checkup"));
    expect(checkup.getByText("Book the scan")).toBeVisible();
    expect(checkup.queryByText("Pick a clinic")).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Sunday" })).getByText(
        "Checkup",
      ),
    ).toBeVisible();
    expect(
      checkup.getByRole("button", { name: "Complete “Book the scan”" }),
    ).toBeInTheDocument();
  });

  it("reads two dated Tasks on one day as a count and never picks one", () => {
    renderOverview({
      threads: [
        thread("Recovery", {
          tasks: [
            dated("Morning check", today),
            dated("Evening check", today + 20 * 3_600_000),
            dated("Next week", today + 7 * DAY),
          ],
        }),
      ],
    });

    const recovery = within(card("Recovery"));
    expect(recovery.getByText("2 tasks today")).toBeVisible();
    expect(recovery.queryByText("Morning check")).toBeNull();
    expect(recovery.queryByRole("button", { name: /^Complete/ })).toBeNull();
  });

  it("keeps the No date tray's slot rule when a card has undated Tasks only", () => {
    const [a, b] = tasks("A", "B");
    renderOverview({
      threads: [thread("Tray", { tasks: [a!, b!], focusedTaskId: b!._id })],
    });

    const tray = within(card("Tray"));
    expect(tray.getByText("B")).toBeVisible();
    expect(
      tray.getByRole("img", { name: "2 tasks, one focused" }),
    ).toBeVisible();
  });

  it("folds Later and the No date margin on a phone", async () => {
    isMobile.value = true;
    try {
      renderOverview({
        threads: [
          thread("Overdue", { followUp: today - DAY }),
          thread("Distant", { followUp: today + 30 * DAY, order: 1 }),
          thread("Actionable", {
            tasks: tasks("Call the clinic"),
            order: 2,
          }),
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

describe("a Thread card", () => {
  it("heads every card with the Thread's title, and never trades it for a Task", () => {
    const focusedTasks = tasks("Call the clinic", "Book the scan", "Pay");
    renderOverview({
      threads: [
        thread("Focused", {
          tasks: focusedTasks,
          focusedTaskId: focusedTasks[1]!._id,
        }),
        thread("Only task", { tasks: tasks("Email the landlord"), order: 1 }),
        thread("Unfocused", { tasks: tasks("A", "B", "C"), order: 2 }),
        thread("No tasks", { order: 3 }),
      ],
    });

    for (const title of ["Focused", "Only task", "Unfocused", "No tasks"]) {
      expect(screen.getByRole("link", { name: title })).toBeVisible();
    }
  });

  it("puts the Focused Task in the task slot, with a quiet count of the others", () => {
    const focusedTasks = tasks("Call the clinic", "Book the scan", "Pay");
    renderOverview({
      threads: [
        thread("Checkup", {
          tasks: focusedTasks,
          focusedTaskId: focusedTasks[1]!._id,
        }),
      ],
    });

    const checkup = within(card("Checkup"));
    expect(checkup.getByText("Book the scan")).toBeVisible();
    expect(checkup.queryByText("Call the clinic")).toBeNull();
    expect(
      checkup.getByRole("img", { name: "3 tasks, one focused" }),
    ).toBeVisible();
    expect(
      checkup.getByRole("button", { name: "Complete “Book the scan”" }),
    ).toBeInTheDocument();
  });

  it("shows the only Task without asking for a focus", () => {
    renderOverview({
      threads: [thread("Deposit", { tasks: tasks("Email the landlord") })],
    });

    const deposit = within(card("Deposit"));
    expect(deposit.getByText("Email the landlord")).toBeVisible();
    expect(deposit.queryByRole("img")).toBeNull();
    expect(
      deposit.getByRole("button", { name: "Complete “Email the landlord”" }),
    ).toBeInTheDocument();
  });

  it("counts several unfocused Tasks instead of inventing a headline, and offers nothing to complete", () => {
    renderOverview({
      threads: [thread("Birthday", { tasks: tasks("A", "B", "C") })],
    });

    const birthday = within(card("Birthday"));
    expect(birthday.getByText("3 tasks · none focused")).toBeVisible();
    // The task slot already gives the count; pips would only repeat it.
    expect(birthday.queryByRole("img")).toBeNull();
    expect(birthday.queryByRole("button", { name: /^Complete/ })).toBeNull();
  });

  it("shows a Thread with no Tasks as its title alone", () => {
    renderOverview({ threads: [thread("Garden")] });

    const garden = within(card("Garden"));
    expect(garden.queryByText(/tasks/)).toBeNull();
    expect(garden.queryByRole("button", { name: /^Complete/ })).toBeNull();
  });
});
