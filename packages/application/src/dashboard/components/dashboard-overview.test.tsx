import type { AreaSummary, TaskId, Note, Thread } from "@vita-os/contracts";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

import { act, render, screen, within } from "@testing-library/react";
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
  useCompletingTaskIds: () => new Set(),
}));
vi.mock("../../threads/use-update-thread", () => ({
  useUpdateThread: () => vi.fn(),
}));
vi.mock("../../notes/use-archive-note", () => ({
  useArchiveNote: () => vi.fn(),
}));
vi.mock("../../notes/use-complete-note", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../notes/use-complete-note")>()),
  useCompleteNote: () => vi.fn(),
}));
vi.mock("../../notes/use-set-note-repeat", () => ({
  useSetNoteRepeat: () => vi.fn(),
}));
vi.mock("../../notes/use-update-note-body", () => ({
  useUpdateNoteBody: () => vi.fn(),
}));
vi.mock("../../notes/use-update-note-when", () => ({
  useUpdateNoteWhen: () => vi.fn(),
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

/** The items under one of the list's groups, Today or Late or a day. */
function groupText(name: string) {
  return within(screen.getByRole("region", { name }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

/** The list's groups, top to bottom, by their headings. */
function groupLabels() {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.closest("section")?.getAttribute("aria-label"))
    .filter((label) => label !== undefined && label !== "No date");
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
    ).toEqual(["All2", "Notes1"]);
  });

  it("sets Notes apart after the Areas, then offers Edit areas", () => {
    renderOverview();

    const row = screen.getByRole("navigation", { name: "Filter the board" });
    const noArea = within(row).getByRole("link", { name: /No area/ });
    const notes = within(row).getByRole("link", { name: /Notes/ });
    const edit = within(row).getByRole("button", { name: "Edit areas" });
    expect(
      noArea.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notes.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING,
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
      ["All5", "/"],
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

    expect(groupText("Today")).toEqual([
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

    expect(groupText("Today")).toEqual([expect.stringContaining("Passport")]);
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

    expect(groupText("Today")).toEqual([
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
      screen.getByRole("region", { name: "Today" }),
    ).getAllByRole("listitem");
    expect(within(labeled!).getByTitle("Health")).toHaveTextContent("Health");
    expect(within(unlabeled!).queryByTitle("Health")).not.toBeInTheDocument();
    expect(within(unlabeled!).queryByTitle("Home")).not.toBeInTheDocument();
  });

  it("reads every dated item as one list, attention first, each group with its count", () => {
    renderOverview({
      threads: [
        thread("Late one", { followUp: today - DAY }),
        thread("Also late", { followUp: today - DAY, order: 1 }),
        thread("Midweek", { followUp: today + 2 * DAY, order: 2 }),
        thread("Next week", { followUp: today + 9 * DAY, order: 3 }),
        thread("Distant", { followUp: today + 30 * DAY, order: 4 }),
      ],
      notes: [note("Water the plants", { followUp: today })],
    });

    expect(groupLabels()).toEqual([
      "Late",
      "Today",
      "Sunday",
      "In 1 week",
      "August",
    ]);
    expect(screen.getByRole("region", { name: "Late" })).toHaveTextContent(
      /^Late2/,
    );
    expect(groupText("Today")).toEqual([
      expect.stringContaining("Water the plants"),
    ]);
  });

  it("shows items from next week on as one line each, opening what they are", () => {
    renderOverview({
      threads: [thread("Distant", { followUp: today + 30 * DAY })],
      notes: [
        note("Renew the passport\nBring photos", {
          followUp: today + 10 * DAY,
        }),
      ],
    });

    const week = screen.getByRole("region", { name: "In 1 week" });
    const line = within(week).getByRole("button", {
      name: /^Open note: Renew the passport/,
    });
    // A Note's first line, and its date: no card controls.
    expect(line).toHaveTextContent(/^Renew the passport10d$/);
    expect(
      within(week).queryByRole("button", { name: "Archive note" }),
    ).toBeNull();

    const month = screen.getByRole("region", { name: "August" });
    expect(within(month).getByRole("link")).toHaveAttribute(
      "href",
      // The thread pane opens over this page (the mocked Link keeps `.`).
      ".?thread=distant",
    );
    // A Thread's row reads "Task · Thread", so its rows in a week read apart.
    expect(within(month).getByRole("link")).toHaveTextContent(
      /^Follow up · DistantAug 16$/,
    );
  });

  it("drops a late card's own tint on Late's fill", () => {
    renderOverview({
      threads: [thread("Overdue", { followUp: today - DAY })],
    });

    const sheet = card("Overdue").querySelector('[class*="group/card"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.className).not.toMatch(/condition-attention\)_7%/);
  });

  it("heads each group with when it comes due, and leaves an exact day to its heading", () => {
    renderOverview({
      threads: [
        thread("Overdue", { followUp: today - 3 * DAY }),
        thread("Dentist", { followUp: today }),
        thread("Tomorrow one", { followUp: today + DAY, order: 1 }),
        thread("Sunday one", { followUp: today + 2 * DAY, order: 2 }),
        thread("Sunday two", { followUp: today + 2 * DAY, order: 3 }),
      ],
    });

    const group = (name: string) => screen.getByRole("region", { name });

    // A late card keeps its own date: "Late" says only that it slipped.
    expect(group("Late")).toHaveTextContent(/^Late1/);
    expect(within(group("Late")).getByText("−3d")).toBeVisible();
    // Only the heading says Today; the card under it carries no token.
    expect(within(group("Today")).getAllByText(/Today/)).toHaveLength(1);

    const tomorrow = group("Tomorrow");
    expect(tomorrow).toHaveTextContent(/^TomorrowSaturday1/);
    expect(within(tomorrow).queryByText("Sat")).not.toBeInTheDocument();
    // The date still opens from the card, as a control rather than a token.
    expect(
      within(tomorrow).getByRole("button", { name: "Change date" }),
    ).toBeInTheDocument();

    const sunday = group("Sunday");
    expect(sunday).toHaveTextContent(/^Sundayin 2 days2/);
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

    const todayGroup = screen.getByRole("region", { name: "Today" });
    const titles = within(todayGroup)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(titles).toEqual(["Sometime today", "Afternoon call"]);
    expect(within(todayGroup).getByText("3 PM")).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Late" })).getByText(
        "−2d · 9:30 AM",
      ),
    ).toBeVisible();
  });

  /**
   * #236, settled: a Follow-up outranks undated Tasks, so an actionable
   * Thread with no date keeps its own run in the margin rather than in Now.
   */
  it("keeps undated Tasks off the list and in No date", () => {
    renderOverview({
      threads: [
        thread("Dated", { followUp: today }),
        thread("Actionable", { tasks: tasks("Call the clinic"), order: 1 }),
        thread("Idle", { order: 2 }),
      ],
      notes: [note("Loose thought")],
    });

    expect(groupText("Today")).toEqual([expect.stringContaining("Dated")]);

    // No date is an <aside> beside the list, a complementary landmark.
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

    expect(groupText("Today")).toEqual([expect.stringContaining("Mixed")]);
    expect(groupText("Tomorrow")).toEqual([expect.stringContaining("Soon")]);
    expect(screen.getByRole("region", { name: "August" })).toHaveTextContent(
      "Far only",
    );
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

  it("leads a dated card with its Task, the Thread's title under it, and leaves undated Tasks off the board", () => {
    renderOverview({
      threads: [
        thread("Checkup", {
          tasks: [
            ...tasks("Pick a clinic"),
            dated("Book the scan", today + 2 * DAY),
          ],
        }),
      ],
    });

    const sunday = screen.getByRole("region", { name: "Sunday" });
    const checkup = within(card("Checkup"));
    expect(card("Checkup")).toHaveTextContent(/^Task: Book the scanCheckup/);
    expect(checkup.getByRole("link", { name: "Checkup" })).toBeVisible();
    expect(screen.queryByText("Pick a clinic")).toBeNull();
    expect(within(sunday).getAllByRole("listitem")).toHaveLength(1);
    expect(
      checkup.getByRole("button", { name: "Complete “Book the scan”" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "No date" })).getByText(
        "Everything open has a date.",
      ),
    ).toBeVisible();
  });

  it("stands a Thread once per dated Task: two on one day are two cards, each acting on its own Task", () => {
    renderOverview({
      threads: [
        thread("Recovery", {
          tasks: [
            dated("Morning check", today),
            dated("Evening check", today + 20 * 3_600_000),
            dated("Plan the week", today + 7 * DAY),
          ],
        }),
      ],
    });

    const todayGroup = screen.getByRole("region", { name: "Today" });
    // The heading counts cards, not Threads.
    expect(todayGroup).toHaveTextContent(/^Today2/);
    const [morning, evening] = within(todayGroup).getAllByRole("listitem");
    expect(morning).toHaveTextContent(/^Task: Morning checkRecovery/);
    expect(evening).toHaveTextContent(/^Task: Evening checkRecovery/);
    expect(
      within(morning!).getByRole("button", {
        name: "Complete “Morning check”",
      }),
    ).toBeInTheDocument();
    expect(
      within(evening!).getByRole("button", {
        name: "Complete “Evening check”",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tasks today/)).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "In 1 week" })).getByRole(
        "link",
      ),
    ).toHaveTextContent(/^Plan the week · Recovery7d$/);
  });

  it("rings every copy of a Thread while one is hovered or focused, and never a Thread that stands once", async () => {
    const user = userEvent.setup();
    renderOverview({
      threads: [
        thread("Kitchen", {
          tasks: [
            dated("Buy a washer", today),
            dated("Call the plumber", today + 2 * DAY),
            dated("Repaint", today + 9 * DAY),
          ],
        }),
        thread("Dentist", { followUp: today, order: 1 }),
      ],
    });

    const copies = () =>
      screen
        .getAllByRole("link", { name: /Kitchen/ })
        .map((link) => link.closest("[data-slot=thread-copy]"));
    const ringed = () =>
      document.querySelectorAll("[data-slot=thread-copy][data-ringed]");
    expect(copies()).toHaveLength(3);
    expect(ringed()).toHaveLength(0);

    await user.hover(screen.getByText("Buy a washer"));
    expect([...ringed()]).toEqual(copies());
    for (const copy of copies()) {
      expect(copy).toHaveClass("ring-2", "ring-brand-accent/60");
    }

    await user.unhover(screen.getByText("Buy a washer"));
    expect(ringed()).toHaveLength(0);

    // The one-line row in the weeks rings its card copies too, by keyboard.
    act(() =>
      within(screen.getByRole("region", { name: "In 1 week" }))
        .getByRole("link")
        .focus(),
    );
    expect([...ringed()]).toEqual(copies());

    act(() => screen.getByRole("link", { name: "Dentist" }).focus());
    expect(ringed()).toHaveLength(0);
    await user.hover(screen.getByRole("link", { name: "Dentist" }));
    expect(ringed()).toHaveLength(0);
  });

  const kitchen = () =>
    thread("Kitchen", {
      tasks: [
        dated("Buy a washer", today),
        dated("Call the plumber", today + 2 * DAY),
      ],
    });
  const ringedCopies = () =>
    document.querySelectorAll("[data-slot=thread-copy][data-ringed]");

  it("keeps the ring while a copy holds keyboard focus, after the pointer passes over and leaves it", async () => {
    const user = userEvent.setup();
    renderOverview({ threads: [kitchen()] });
    const washer = screen.getByText("Buy a washer");
    const [link] = screen.getAllByRole("link", { name: "Kitchen" });

    act(() => link!.focus());
    await user.hover(washer);
    await user.unhover(washer);
    expect(ringedCopies()).toHaveLength(2);

    act(() => link!.blur());
    expect(ringedCopies()).toHaveLength(0);
  });

  it("drops the ring of a focused copy the filter takes away, so it comes back at rest", () => {
    const board = (filter: OverviewProps["filter"]) => (
      <FeedbackProvider feedback={createFeedbackMock()}>
        <DashboardOverview
          areas={areas}
          currentDate={currentDate}
          filter={filter}
          notes={[]}
          threads={[
            kitchen(),
            thread("Fix the gate", {
              areaId: "home" as Thread["areaId"],
              followUp: today,
              order: 1,
            }),
          ]}
        />
      </FeedbackProvider>
    );
    const { rerender } = render(board({}));

    act(() => screen.getAllByRole("link", { name: "Kitchen" })[0]!.focus());
    expect(ringedCopies()).toHaveLength(2);

    rerender(board({ area: "home" }));
    expect(screen.queryByRole("link", { name: "Kitchen" })).toBeNull();
    expect(screen.getByRole("link", { name: "Fix the gate" })).toBeVisible();

    rerender(board({}));
    expect(screen.getAllByRole("link", { name: "Kitchen" })).toHaveLength(2);
    expect(ringedCopies()).toHaveLength(0);
  });

  it("leads the list with No date folded to one line, which opens in place", async () => {
    renderOverview({
      threads: [
        thread("Overdue", { followUp: today - DAY }),
        thread("Actionable", { tasks: tasks("Call the clinic"), order: 1 }),
        thread("Idle", { order: 2 }),
      ],
      notes: [note("Loose thought")],
    });

    // Below `lg`; from `lg` the same runs sit in the aside instead.
    const folded = screen.getByRole("region", { name: "No date" });
    const toggle = within(folded).getByRole("button", { expanded: false });
    expect(toggle).toHaveTextContent("Actionable, Idle and 1 more");
    expect(folded).toHaveTextContent(/^No date3/);
    expect(within(folded).queryByText("Call the clinic")).toBeNull();
    expect(
      folded.compareDocumentPosition(
        screen.getByRole("region", { name: "Late" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(folded).getByText("Call the clinic")).toBeVisible();
    expect(
      within(folded).getByRole("region", { name: "Ready to move" }),
    ).toBeVisible();
  });

  it("leaves the folded No date out when everything has a date", () => {
    renderOverview({
      threads: [thread("Overdue", { followUp: today - DAY })],
    });

    expect(screen.queryByRole("region", { name: "No date" })).toBeNull();
    expect(
      within(screen.getByRole("complementary", { name: "No date" })).getByText(
        "Everything open has a date.",
      ),
    ).toBeVisible();
  });

  it("says so plainly when nothing is asking", () => {
    renderOverview();

    expect(screen.getByText("Nothing is asking for you.")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Today" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("a No date Thread card", () => {
  it("heads every card with the Thread's title", () => {
    renderOverview({
      threads: [
        thread("Only task", { tasks: tasks("Email the landlord") }),
        thread("Several", { tasks: tasks("A", "B", "C"), order: 1 }),
        thread("No tasks", { order: 2 }),
      ],
    });

    for (const title of ["Only task", "Several", "No tasks"]) {
      expect(card(title)).toHaveTextContent(new RegExp(`^${title}`));
    }
  });

  it("shows the only Task under the title, and completes it", () => {
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

  it("counts several Tasks instead of inventing a headline, and offers nothing to complete", () => {
    renderOverview({
      threads: [thread("Birthday", { tasks: tasks("A", "B", "C") })],
    });

    const birthday = within(card("Birthday"));
    expect(birthday.getByText("3 tasks")).toBeVisible();
    expect(birthday.queryByText("A")).toBeNull();
    expect(birthday.queryByRole("img")).toBeNull();
    expect(birthday.queryByRole("button", { name: /^Complete/ })).toBeNull();
    // A date set here adds a Follow up rather than pick one of the three.
    expect(
      birthday.getByRole("button", { name: "Set date" }),
    ).toBeInTheDocument();
  });

  it("shows a Thread with no Tasks as its title alone", () => {
    renderOverview({ threads: [thread("Garden")] });

    const garden = within(card("Garden"));
    expect(garden.queryByText(/tasks/)).toBeNull();
    expect(garden.queryByRole("button", { name: /^Complete/ })).toBeNull();
  });
});
