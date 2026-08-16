import type { PropsWithChildren } from "react";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";

import { PlanCanvas } from "./plan-canvas";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params = {},
    to,
    ...props
  }: PropsWithChildren<{ params?: Record<string, string>; to: string }>) => (
    <a
      href={Object.entries(params).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...props}
    >
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
}));

const now = new Date(2026, 7, 6, 9).getTime();
const day = (offset: number) => new Date(2026, 7, 6 + offset).getTime();

const areas: DashboardArea[] = [
  {
    condition: "healthy",
    icon: "Home",
    id: "home",
    name: "Home",
    order: 1,
    slug: "home",
  },
  {
    condition: "critical",
    icon: "HeartPulse",
    id: "health",
    name: "Family Health",
    order: 0,
    slug: "family-health",
  },
  // Deliberately empty: a critical lane must still declare its condition.
  {
    condition: "critical",
    icon: "WalletCards",
    id: "finance",
    name: "Finance",
    order: 2,
    slug: "finance",
  },
];

const threads: DashboardThread[] = [
  {
    areaId: "health",
    followUp: day(-3),
    id: "t1",
    order: 0,
    slug: "dads-cardiologist",
    title: "Dad's cardiologist",
  },
  {
    areaId: "home",
    followUp: day(2),
    id: "t2",
    nextMove: "Call the plumber",
    order: 1,
    slug: "kitchen-faucet",
    title: "Kitchen faucet",
  },
  {
    areaId: "home",
    id: "t3",
    order: 2,
    slug: "garage-clear-out",
    title: "Garage clear-out",
  },
  // Past `MAX_HORIZON`: the axis never draws this day, so the chip docks in the
  // Later bay instead.
  {
    areaId: "home",
    followUp: day(120),
    id: "t4",
    nextMove: "Book the sweep",
    order: 3,
    slug: "chimney-sweep",
    title: "Chimney sweep",
  },
];

const tasks: DashboardInboxTask[] = [
  { createdAt: day(-1), id: "k1", text: "Renew passport", when: day(1) },
];

function renderCanvas() {
  const planActions = { planTask: vi.fn(), planThread: vi.fn() };
  return {
    ...render(
      <PlanCanvas
        areas={areas}
        currentDate={now}
        planActions={planActions}
        tasks={tasks}
        threads={threads}
      />,
    ),
    planActions,
  };
}

/* -------------------------------------------------------------------- dnd -- */

/**
 * dnd-kit decides what a drag is over from measured rectangles, and jsdom
 * reports every rectangle as zero — every slot would collide with every other.
 * So the drop targets are laid out here on a synthetic strip: each element
 * carrying a `data-slot-key` gets its own 100px-wide cell, in document order.
 */
const CELL = 100;

function cellRect(index: number): DOMRect {
  const left = index * CELL;
  return {
    bottom: CELL,
    height: CELL,
    left,
    right: left + CELL,
    toJSON: () => ({}),
    top: 0,
    width: CELL,
    x: left,
    y: 0,
  };
}

function slots(): Element[] {
  return [...document.querySelectorAll("[data-slot-key]")];
}

function measureSlots() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const index = slots().indexOf(this);
      return index < 0 ? cellRect(-CELL) : cellRect(index);
    },
  );
}

/** The pointer position that lands inside a lane's slot, e.g. `home::beyond`. */
function centreOf(slotKey: string): { clientX: number; clientY: number } {
  const index = slots().findIndex(
    (slot) => slot.getAttribute("data-slot-key") === slotKey,
  );
  expect(index, `no drop target ${slotKey}`).toBeGreaterThanOrEqual(0);
  return { clientX: index * CELL + CELL / 2, clientY: CELL / 2 };
}

/**
 * Lift the chip, hover the slot, let go — the whole gesture dnd-kit expects.
 * `whileOver` runs with the chip still in the air, which is the only moment the
 * drag overlay and its caption exist.
 */
async function dragChipTo(
  itemId: string,
  slotKey: string,
  whileOver?: () => void,
) {
  const chip = document.querySelector(`[data-chip="${itemId}"]`)!;
  const target = centreOf(slotKey);

  await act(async () => {
    fireEvent.mouseDown(chip, { clientX: 0, clientY: 0 });
    // Past the 5px activation distance, so the drag arms rather than clicks.
    fireEvent.mouseMove(document, { clientX: 40, clientY: 0 });
  });
  await act(async () => {
    fireEvent.mouseMove(document, target);
  });
  whileOver?.();
  await act(async () => {
    fireEvent.mouseUp(document, target);
  });
  // dnd-kit swallows clicks on a capture-phase document listener it removes
  // only 50ms after the drop; a dialog click inside that window goes dead.
  await act(() => new Promise((resolve) => setTimeout(resolve, 60)));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlanCanvas", () => {
  it("lays Areas out worst condition first over a day axis, Inbox last", () => {
    renderCanvas();

    const canvas = screen.getByRole("region", { name: "Plan" });
    expect(within(canvas).getByText("Today")).toBeVisible();
    expect(within(canvas).getByText("Waiting")).toBeVisible();
    expect(within(canvas).getByText("No date")).toBeVisible();

    // The Area names appear on the filter chips too; the lane headings are the
    // last of each.
    const critical = screen.getAllByText("Family Health").at(-1)!;
    const healthy = screen.getAllByText("Home").at(-1)!;
    const inbox = screen.getByText("Inbox");

    expect(
      critical.compareDocumentPosition(healthy) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      healthy.compareDocumentPosition(inbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Every open item is on the canvas, dated or not.
    expect(screen.getByText("Dad's cardiologist")).toBeVisible();
    expect(screen.getByText("Kitchen faucet")).toBeVisible();
    expect(screen.getByText("Garage clear-out")).toBeVisible();
    expect(screen.getByText("Renew passport")).toBeVisible();

    // The tally reads off the same buckets the lanes do, Inbox included.
    expect(within(canvas).getByText("1 waiting")).toBeVisible();
    expect(within(canvas).getByText("1 undated")).toBeVisible();
    expect(within(canvas).getByText("1 in Inbox")).toBeVisible();
  });

  it("leads a Thread chip with its Next Move, keeping the title beneath it", () => {
    renderCanvas();

    // t2 (Kitchen faucet) carries a Next Move: it becomes the primary line,
    // the title demotes to a muted identifier — both still on the canvas.
    expect(screen.getByText("Call the plumber")).toBeVisible();
    expect(screen.getByText("Kitchen faucet")).toBeVisible();

    // Threads without a Next Move keep the same layout, the empty slot
    // printing a faint placeholder above the title (t1 and t3).
    expect(screen.getByText("Dad's cardiologist")).toBeVisible();
    expect(screen.getByText("Garage clear-out")).toBeVisible();
    expect(screen.getAllByText("No Next Move")).toHaveLength(2);
  });

  it("links each Area lane header to its Area page, Inbox staying plain", () => {
    renderCanvas();

    expect(
      screen.getByRole("link", { name: "Open Family Health" }),
    ).toHaveAttribute("href", "/family-health");
    expect(screen.getByRole("link", { name: "Open Home" })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(screen.queryByRole("link", { name: /Inbox/ })).toBeNull();
  });

  it("declares a non-healthy lane's condition even when it is empty", () => {
    renderCanvas();

    const header = screen.getByRole("link", { name: "Open Finance" });
    expect(within(header).getByText("Critical")).toBeVisible();
    expect(within(header).getByText(/No open Threads/)).toBeVisible();
  });

  it("opens a Thread in place and sends a Task to the Inbox", async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.click(screen.getByText("Kitchen faucet"));

    const [threadCall] = mocks.navigate.mock.calls.at(-1) as [
      { search: (previous: object) => object; to: string },
    ];
    expect(threadCall.to).toBe(".");
    expect(threadCall.search({ other: 1 })).toEqual({
      other: 1,
      thread: "kitchen-faucet",
    });

    await user.click(screen.getByText("Renew passport"));
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: "/inbox" });
  });

  it("isolates an Area on the first filter click, Inbox always in view", async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.click(screen.getByRole("button", { name: /Family Health/ }));

    expect(screen.getByText("Dad's cardiologist")).toBeVisible();
    expect(screen.queryByText("Kitchen faucet")).toBeNull();
    expect(screen.queryByText("Garage clear-out")).toBeNull();
    expect(screen.getByText("Renew passport")).toBeVisible();
  });

  it("pins a Later bay inboard of No date, holding work dated off the axis", () => {
    renderCanvas();

    const canvas = screen.getByRole("region", { name: "Plan" });
    const later = canvas.querySelector('[data-bay="beyond"]')!;
    const noDate = canvas.querySelector('[data-bay="none"]')!;

    expect(within(later as HTMLElement).getByText("Later")).toBeVisible();
    // One Thread is dated past the end of the axis; nothing is undated but t3.
    expect(within(later as HTMLElement).getByText("1")).toBeVisible();
    expect(
      later.compareDocumentPosition(noDate) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Position cannot say when, so the chip prints its own day.
    const chip = document.querySelector('[data-chip="t4"]')!;
    expect(chip.closest("[data-slot-key]")).toHaveAttribute(
      "data-slot-key",
      "home::beyond",
    );
    expect(within(chip as HTMLElement).getByText("Fri 4 Dec")).toBeVisible();
  });

  it("answers a drop on Later with a calendar, writing only once a day is picked", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "home::beyond", () => {
      // The lifted chip promises a picker rather than a day.
      expect(screen.getByText("Pick a day")).toBeVisible();
    });

    // The drop itself writes nothing: the bay names no single day.
    expect(planActions.planThread).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Kitchen faucet")).toBeVisible();

    await user.click(
      within(dialog).getByRole("button", { name: /August 12th/ }),
    );

    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      followUp: day(6),
    });
  });

  it("carries the Area move through the Later calendar", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "health::beyond");

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Kitchen faucet → Family Health"),
    ).toBeVisible();

    await user.click(
      within(dialog).getByRole("button", { name: /August 12th/ }),
    );

    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      areaId: "health",
      followUp: day(6),
    });
  });

  it("confirms the day the item already sits on, keeping the Area move", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    // "Chimney sweep" is already dated day(120): moving it across lanes via
    // Later and re-picking its own day must still write the Area move.
    await dragChipTo("t4", "health::beyond");

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /December 4th/ }),
    );

    expect(planActions.planThread).toHaveBeenCalledWith("t4", {
      areaId: "health",
      followUp: day(120),
    });
  });

  it("opens on today, unselected, for a chip dragged out of Waiting", async () => {
    renderCanvas();
    measureSlots();

    // t1 is overdue: its past date must not drag the calendar into a month
    // where every day is disabled.
    await dragChipTo("t1", "health::beyond");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("August 2026")).toBeVisible();
    expect(dialog.querySelector('[data-selected-single="true"]')).toBeNull();
  });

  it("forgets the pending drop when the item disappears mid-pick", async () => {
    const { planActions, rerender } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "health::beyond");
    await screen.findByRole("dialog");

    rerender(
      <PlanCanvas
        areas={areas}
        currentDate={now}
        planActions={planActions}
        tasks={tasks}
        threads={threads.filter((thread) => thread.id !== "t2")}
      />,
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(planActions.planThread).not.toHaveBeenCalled();
  });

  it("leaves the item alone when the Later calendar is dismissed", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "health::beyond");
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    // Not even the Area move: an abandoned pick abandons the whole drop.
    expect(planActions.planThread).not.toHaveBeenCalled();
    expect(planActions.planTask).not.toHaveBeenCalled();
  });

  it("sends an Inbox Task through the same Later calendar", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("k1", "inbox::beyond");

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /August 12th/ }),
    );

    expect(planActions.planTask).toHaveBeenCalledWith("k1", day(6));
  });

  it("keeps a plain day drop writing straight through, and refuses the past", async () => {
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "home::d0");
    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      followUp: day(0),
    });

    // No date clears the day rather than opening anything.
    planActions.planThread.mockClear();
    await dragChipTo("t2", "home::none");
    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      followUp: undefined,
    });

    // The waiting bay shows a debt; it never takes a new plan.
    planActions.planThread.mockClear();
    await dragChipTo("t2", "home::overdue");
    expect(planActions.planThread).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rebuilds the axis when the attention clock rolls the day over", () => {
    const laneThreads: DashboardThread[] = [
      {
        areaId: "home",
        followUp: day(0),
        id: "t9",
        order: 0,
        slug: "water-plants",
        title: "Water plants",
      },
    ];
    const view = (clock: number) => (
      <PlanCanvas
        areas={areas}
        currentDate={clock}
        planActions={{ planTask: vi.fn(), planThread: vi.fn() }}
        tasks={[]}
        threads={laneThreads}
      />
    );
    const canvas = () => screen.getByRole("region", { name: "Plan" });

    const { rerender } = render(view(now));
    expect(within(canvas()).queryByText("Waiting")).toBeNull();

    rerender(view(new Date(2026, 7, 7, 9).getTime()));

    expect(within(canvas()).getByText("Waiting")).toBeVisible();
    expect(within(canvas()).getByText("1 waiting")).toBeVisible();
  });
});
