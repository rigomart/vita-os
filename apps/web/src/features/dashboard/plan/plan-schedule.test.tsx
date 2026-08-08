import { api } from "@convex/_generated/api";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { getFunctionName } from "convex/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";

import { PlanSchedule } from "./plan-schedule";

const mocks = vi.hoisted(() => ({
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    const existing = mocks.mutations.get(name);
    const mutation =
      existing ?? vi.fn(() => Promise.resolve(undefined as unknown));
    mocks.mutations.set(name, mutation);
    return Object.assign(mutation, { withOptimisticUpdate: () => mutation });
  },
}));

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
    id: "home",
    name: "Home",
    order: 1,
    slug: "home",
  },
  {
    condition: "critical",
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
];

const tasks: DashboardInboxTask[] = [
  { createdAt: day(-1), id: "k1", text: "Renew passport", when: day(1) },
];

function renderSchedule() {
  return render(
    <FeedbackProvider feedback={{ error: vi.fn(), success: vi.fn() }}>
      <PlanSchedule
        areas={areas}
        currentDate={now}
        tasks={tasks}
        threads={threads}
      />
    </FeedbackProvider>,
  );
}

/** True when `first` sits before `second` in document order. */
function precedes(first: Element, second: Element) {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

const weekdayRails = () => screen.getAllByText(WEEKDAY);

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

  it("opens a Thread in place and sends a Task to the Inbox", async () => {
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
    expect(mocks.navigate).toHaveBeenLastCalledWith({ to: "/inbox" });
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

  it("wires both writes to the app's own mutations", () => {
    renderSchedule();

    expect([...mocks.mutations.keys()]).toEqual(
      expect.arrayContaining([
        getFunctionName(api.threads.update),
        getFunctionName(api.tasks.updateWhen),
      ]),
    );
  });
});
