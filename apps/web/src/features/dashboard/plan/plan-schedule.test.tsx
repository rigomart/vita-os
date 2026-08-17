import type { DragEndEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";

import { PlanSchedule } from "./plan-schedule";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  onDragEnd: null as ((event: DragEndEvent) => void) | null,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => ({}),
}));

/**
 * A pointer drag needs layout, which jsdom does not have, so the context is
 * replaced by one that hands the drag-end handler straight to the test. The
 * droppable and draggable hooks stay real — they only ever report "not over"
 * without a live drag, which is what the static trees below assert against.
 */
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: ReactNode;
      onDragEnd: (event: DragEndEvent) => void;
    }) => {
      mocks.onDragEnd = onDragEnd;
      return children;
    },
    DragOverlay: ({ children }: { children: ReactNode }) => children,
  };
});

/** The drop dnd-kit would have reported, without the pointer that made it. */
function drop(
  source: { itemId: string; kind: "task" | "thread"; slotKey: string },
  overSlotKey: string,
) {
  act(() => {
    mocks.onDragEnd?.({
      active: { data: { current: source } },
      over: { data: { current: { slotKey: overSlotKey } } },
    } as unknown as DragEndEvent);
  });
}

/**
 * The list opens on today, and jsdom ships `window.scrollTo` as a
 * not-implemented stub that only complains to the virtual console. Replacing it
 * here keeps the mount effect quiet; `IntersectionObserver` needs no stub — jsdom
 * has none and the component already guards on that, which is what keeps the
 * floating Today pill out of these trees.
 */
beforeAll(() => {
  window.scrollTo = vi.fn();
});

/** A Thursday in August, so the near horizon crosses into September. */
const now = new Date(2026, 7, 6, 9).getTime();
const day = (offset: number) => new Date(2026, 7, 6 + offset).getTime();

/** Weekday over day number is the schedule's only date marker. */
const WEEKDAY = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/;

const NEAR_WEEKDAYS = [
  "Thu",
  "Fri",
  "Sat",
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
  "Mon",
  "Tue",
  "Wed",
];

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
    nextMove: "Call the plumber back",
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
  {
    areaId: "home",
    // Four months out: past the ceiling the agenda draws, so it lists in Later.
    followUp: day(120),
    id: "t4",
    order: 3,
    slug: "roof-replacement",
    title: "Roof replacement",
  },
];

/** The day `day(120)` falls on, as the Later section prints it. */
const BEYOND_CAPTION = "Fri 4 Dec";

const tasks: DashboardInboxTask[] = [
  { createdAt: day(-1), id: "k1", text: "Renew passport", when: day(1) },
];

function renderSchedule() {
  const planActions = { planTask: vi.fn(), planThread: vi.fn() };
  return {
    ...render(
      <PlanSchedule
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

/** True when `first` sits before `second` in document order. */
function precedes(first: Element, second: Element) {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

const weekdayRails = () => screen.getAllByText(WEEKDAY);

/** The calendar's cell for a day of the month, inside the open picker. */
function dayCell(label: string) {
  const dialog = screen.getByRole("dialog");
  const cell = within(dialog)
    .getAllByRole("button")
    .find((button) => button.textContent?.trim() === label);
  if (!cell) throw new Error(`no day cell for ${label}`);
  return cell;
}

beforeEach(() => {
  mocks.navigate.mockClear();
  mocks.onDragEnd = null;
});

describe("PlanSchedule", () => {
  it("prints the near horizon day by day, today first and empty days kept", () => {
    renderSchedule();

    const rails = weekdayRails();
    expect(rails.map((rail) => rail.textContent)).toEqual(NEAR_WEEKDAYS);

    // Today leads the list: Thursday 6 August, the day `now` falls on.
    expect(within(rails[0].parentElement!).getByText("6")).toBeVisible();

    // A day nobody planned into keeps its rail rather than folding away.
    expect(within(rails[1].parentElement!).getByText("7")).toBeVisible();

    // Dated work reads down the page in date order.
    expect(
      precedes(
        screen.getByText("Renew passport"),
        screen.getByText("Kitchen faucet"),
      ),
    ).toBe(true);
  });

  it("puts an overdue Thread in Waiting, above the calendar", () => {
    renderSchedule();

    const heading = screen.getByText("Waiting");
    const overdue = screen.getByText("Dad's cardiologist");
    const firstMonth = screen.getByText("August 2026");

    expect(precedes(heading, overdue)).toBe(true);
    expect(precedes(overdue, firstMonth)).toBe(true);
  });

  it("folds an undated Thread away behind its count", () => {
    renderSchedule();

    const fold = screen.getByRole("button", { name: /No date/ });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(within(fold).getByText("1")).toBeVisible();
    expect(screen.queryByText("Garage clear-out")).toBeNull();
  });

  it("leads a Thread chip with its Next Move, title and Area behind it", () => {
    renderSchedule();

    expect(screen.getByText("Call the plumber back")).toBeVisible();
    // The identifiers stay on the chip, demoted rather than dropped.
    expect(screen.getByText("Kitchen faucet")).toBeVisible();
    expect(screen.getAllByText("Home")[0]).toBeVisible();
  });

  it("prints a faint placeholder on a Thread chip with no Next Move", () => {
    renderSchedule();

    expect(screen.getByText("Dad's cardiologist")).toBeVisible();
    expect(screen.getAllByText("No Next Move").length).toBeGreaterThan(0);
  });

  it("opens a Thread in place and summons the Inbox for a Task", async () => {
    const user = userEvent.setup();
    renderSchedule();

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

  it("opens a run of quiet days into the same day rows", async () => {
    const user = userEvent.setup();
    renderSchedule();

    // Past the near horizon nothing is planned, so the rest of the reach folds.
    const gap = screen.getByRole("button", { name: /quiet days/ });
    expect(within(gap).getByText("14")).toBeVisible();
    expect(screen.queryByText("September 2026")).toBeNull();

    await user.click(gap);

    expect(gap).toHaveAttribute("aria-expanded", "true");
    expect(weekdayRails()).toHaveLength(NEAR_WEEKDAYS.length + 14);
    // The run reaches into September, so it brings the next month band with it.
    expect(screen.getByText("September 2026")).toBeVisible();
  });

  it("unfolds the No-date section onto its items", async () => {
    const user = userEvent.setup();
    renderSchedule();

    await user.click(screen.getByRole("button", { name: /No date/ }));

    expect(screen.getByText("Garage clear-out")).toBeVisible();
  });

  it("folds a far-off Thread into Later, under the agenda", async () => {
    const user = userEvent.setup();
    renderSchedule();

    const fold = screen.getByRole("button", { name: /Later/ });
    expect(within(fold).getByText("1")).toBeVisible();
    expect(screen.queryByText("Roof replacement")).toBeNull();

    await user.click(fold);

    const item = screen.getByText("Roof replacement");
    expect(item).toBeVisible();
    // Off the axis, the chip has to say which day it is actually on.
    expect(screen.getByText(BEYOND_CAPTION)).toBeVisible();
    // Later sits between the last day row and No date.
    expect(precedes(screen.getAllByText(WEEKDAY).at(-1)!, item)).toBe(true);
    expect(
      precedes(item, screen.getByRole("button", { name: /No date/ })),
    ).toBe(true);
  });

  it("opens the day picker on a drop into Later instead of writing", () => {
    const { planActions } = renderSchedule();

    drop({ itemId: "t2", kind: "thread", slotKey: "d2" }, "beyond");

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Pick a day")).toBeVisible();
    // The hint names what is being moved.
    expect(within(dialog).getByText("Kitchen faucet")).toBeVisible();
    expect(planActions.planThread).not.toHaveBeenCalled();
  });

  it("writes the picked day for a dropped Thread and closes the picker", async () => {
    const user = userEvent.setup();
    const { planActions } = renderSchedule();

    drop({ itemId: "t2", kind: "thread", slotKey: "d2" }, "beyond");
    await user.click(dayCell("21"));

    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      followUp: new Date(2026, 7, 21).getTime(),
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("writes the picked day for a dropped Task", async () => {
    const user = userEvent.setup();
    const { planActions } = renderSchedule();

    drop({ itemId: "k1", kind: "task", slotKey: "d1" }, "beyond");
    await user.click(dayCell("21"));

    expect(planActions.planTask).toHaveBeenCalledWith(
      "k1",
      new Date(2026, 7, 21).getTime(),
    );
  });

  it("writes nothing when the picker is dismissed", async () => {
    const user = userEvent.setup();
    const { planActions } = renderSchedule();

    drop({ itemId: "t2", kind: "thread", slotKey: "d2" }, "beyond");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(planActions.planThread).not.toHaveBeenCalled();
    expect(planActions.planTask).not.toHaveBeenCalled();
  });

  it("keeps refusing Waiting and still clears on No date", () => {
    const { planActions } = renderSchedule();

    drop({ itemId: "t2", kind: "thread", slotKey: "d2" }, "overdue");
    expect(planActions.planThread).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    drop({ itemId: "t2", kind: "thread", slotKey: "d2" }, "none");
    expect(planActions.planThread).toHaveBeenCalledWith("t2", {
      followUp: undefined,
    });
    // The section it landed in unfolds, or the drop reads as a deletion.
    expect(screen.getByRole("button", { name: /No date/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
