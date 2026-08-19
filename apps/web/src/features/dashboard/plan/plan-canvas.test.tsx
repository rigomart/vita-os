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

// Base UI's popover measures and observes; jsdom provides neither.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("convex/react", () => ({
  useMutation: () => {
    const mutation = vi.fn();
    return Object.assign(mutation, { withOptimisticUpdate: () => mutation });
  },
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
  useSearch: () => ({}),
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
  // Past `MAX_HORIZON`: the axis never draws this day, so the chip pools in the
  // Later bucket instead.
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
  const onNewThreadInArea = vi.fn();
  return {
    ...render(
      <PlanCanvas
        areas={areas}
        currentDate={now}
        onNewThreadInArea={onNewThreadInArea}
        planActions={planActions}
        tasks={tasks}
        threads={threads}
      />,
    ),
    onNewThreadInArea,
    planActions,
  };
}

/**
 * An Area's filter chip. Its name also appears on the lane header, which is a
 * button of its own now; only the chip carries a pressed state.
 */
function filterChip(name: RegExp) {
  return screen.getByRole("button", { name, pressed: false });
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

/** The pointer position that lands inside a slot, e.g. `home::d0` or `beyond`. */
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

  it("draws no chip wakes where there is no layout to measure", () => {
    renderCanvas();

    // The wakes are pure decoration over measured geometry: with jsdom
    // reporting an empty box the overlay stands down, and the lanes render as
    // they always did rather than painting onto nothing.
    expect(document.querySelectorAll("svg.z-0 circle")).toHaveLength(0);
    expect(screen.getByText("Kitchen faucet")).toBeVisible();
  });

  it("makes every Area lane header its Quick Panel trigger, Inbox staying plain", () => {
    renderCanvas();

    expect(
      screen.getByRole("button", { name: "Area panel for Family Health" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Area panel for Home" }),
    ).toBeVisible();
    // The Inbox lane is not an Area: it has no panel and no link of its own.
    expect(screen.queryByRole("button", { name: /Area panel for Inbox/ })).toBe(
      null,
    );
    expect(screen.queryByRole("link", { name: /Inbox/ })).toBeNull();
  });

  it("declares a non-healthy lane's condition even when it is empty", () => {
    renderCanvas();

    const header = screen.getByRole("button", {
      name: "Area panel for Finance",
    });
    expect(within(header).getByText("Critical")).toBeVisible();
    expect(within(header).getByText(/No open Threads/)).toBeVisible();
  });

  it("opens the Area's panel from its lane header and captures into it", async () => {
    const user = userEvent.setup();
    const { onNewThreadInArea } = renderCanvas();

    await user.click(
      screen.getByRole("button", { name: "Area panel for Family Health" }),
    );

    // The panel's title links through to the Area page.
    expect(
      await screen.findByRole("link", { name: "Family Health" }),
    ).toHaveAttribute("href", "/family-health");

    await user.click(
      screen.getByRole("button", { name: "New Thread in Family Health" }),
    );

    expect(onNewThreadInArea).toHaveBeenCalledWith("health");
  });

  it("opens a Thread in place and summons the Inbox for a Task", async () => {
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

    const [taskCall] = mocks.navigate.mock.calls.at(-1) as [
      { search: (previous: object) => object; to: string },
    ];
    expect(taskCall.to).toBe(".");
    expect(taskCall.search({ thread: "kitchen-faucet" })).toEqual({
      inbox: true,
      thread: "kitchen-faucet",
    });
  });

  it("isolates an Area on the first filter click, Inbox always in view", async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.click(filterChip(/Family Health/));

    expect(screen.getByText("Dad's cardiologist")).toBeVisible();
    expect(screen.queryByText("Kitchen faucet")).toBeNull();
    expect(screen.queryByText("Garage clear-out")).toBeNull();
    expect(screen.getByText("Renew passport")).toBeVisible();
  });

  it("bands every day under its month, naming no region of its own", () => {
    renderCanvas();

    const canvas = screen.getByRole("region", { name: "Plan" });
    const bands = [...canvas.querySelectorAll("[data-band]")].map(
      (band) => band.textContent,
    );

    // The 27-day floor runs past the near region and into the next month.
    expect(bands).toEqual(["August", "September"]);
    // The axis ends on its last day: no Later column, on the band or under it.
    expect(canvas.querySelector('[data-bay="beyond"]')).toBeNull();
  });

  it("pools work dated past the axis in the Later bucket, off the lanes", () => {
    renderCanvas();

    const canvas = screen.getByRole("region", { name: "Plan" });
    const later = screen.getByRole("group", { name: "Later" });

    // One Thread is dated past the end of the axis.
    expect(within(later).getByText("1")).toBeVisible();
    // No lane carries a Later or a No-date bay any more: the buckets own both.
    expect(canvas.querySelector('[data-bay="none"]')).toBeNull();
    expect(canvas.querySelector('[data-slot-key$="::beyond"]')).toBeNull();

    // Position cannot say when, so the chip prints its own day.
    const chip = within(later)
      .getByText("Chimney sweep")
      .closest("[data-chip]")!;
    expect(chip.closest("[data-slot-key]")).toHaveAttribute(
      "data-slot-key",
      "beyond",
    );
    expect(within(chip as HTMLElement).getByText("Fri 4 Dec")).toBeVisible();
  });

  it("answers a drop on Later with a calendar, writing only once a day is picked", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "beyond", () => {
      // The lifted chip promises a picker rather than a day.
      expect(screen.getByText("Pick a day")).toBeVisible();
    });

    // The drop itself writes nothing: the bucket names no single day.
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

  it("leaves the Thread's Area alone: the bucket publishes no lane", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "beyond");

    const dialog = await screen.findByRole("dialog");
    // The hint names the Thread and nothing else — no Area to move to.
    expect(within(dialog).getByText("Kitchen faucet")).toBeVisible();

    await user.click(
      within(dialog).getByRole("button", { name: /August 12th/ }),
    );

    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      followUp: day(6),
    });
  });

  it("re-dates a chip already pooled in Later, opening on its own month", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    // "Chimney sweep" is already dated day(120), so it starts in the bucket:
    // dropping it back on Later is still a valid pick, not a no-op.
    await dragChipTo("t4", "beyond");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("December 2026")).toBeVisible();

    await user.click(
      within(dialog).getByRole("button", { name: /December 4th/ }),
    );

    expect(planActions.planThread).toHaveBeenCalledWith("t4", {
      followUp: day(120),
    });
  });

  it("opens on today, unselected, for a chip dragged out of Waiting", async () => {
    renderCanvas();
    measureSlots();

    // t1 is overdue: its past date must not drag the calendar into a month
    // where every day is disabled.
    await dragChipTo("t1", "beyond");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("August 2026")).toBeVisible();
    expect(dialog.querySelector('[data-selected-single="true"]')).toBeNull();
  });

  it("forgets the pending drop when the item disappears mid-pick", async () => {
    const { planActions, rerender } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "beyond");
    await screen.findByRole("dialog");

    rerender(
      <PlanCanvas
        areas={areas}
        currentDate={now}
        onNewThreadInArea={vi.fn()}
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

    await dragChipTo("t2", "beyond");
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    // An abandoned pick abandons the whole drop: nothing is written.
    expect(planActions.planThread).not.toHaveBeenCalled();
    expect(planActions.planTask).not.toHaveBeenCalled();
  });

  it("sends an Inbox Task through the same Later calendar", async () => {
    const user = userEvent.setup();
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("k1", "beyond");

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

    // The waiting bay shows a debt; it never takes a new plan.
    planActions.planThread.mockClear();
    await dragChipTo("t2", "home::overdue");
    expect(planActions.planThread).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gathers every undated item into one No-date bucket under the lanes", () => {
    renderCanvas();

    const bucket = screen.getByRole("group", { name: "No date" });

    expect(within(bucket).getByText("No date")).toBeVisible();
    expect(within(bucket).getByText("Garage clear-out")).toBeVisible();
    // The count agrees with the tally line above the canvas.
    expect(within(bucket).getByText("1")).toBeVisible();

    // It sits after the Inbox lane, and no lane holds one of its own.
    const inbox = screen.getByText("Inbox");
    expect(
      inbox.compareDocumentPosition(bucket) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByText("No date")).toHaveLength(1);
  });

  it("hides an undated Thread from the bucket when its Area is filtered out", async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.click(filterChip(/Family Health/));

    const bucket = screen.getByRole("group", { name: "No date" });
    expect(within(bucket).queryByText("Garage clear-out")).toBeNull();
  });

  it("clears the date on a drop into the No-date bucket", async () => {
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t2", "none");

    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      followUp: undefined,
    });
  });

  it("drags back out of the bucket onto a day, keeping the Thread's Area", async () => {
    const { planActions } = renderCanvas();
    measureSlots();

    await dragChipTo("t3", "home::d0");

    expect(planActions.planThread).toHaveBeenCalledWith("t3", {
      followUp: day(0),
    });
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
        onNewThreadInArea={vi.fn()}
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
