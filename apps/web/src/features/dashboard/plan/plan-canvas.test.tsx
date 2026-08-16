import type { PropsWithChildren } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
