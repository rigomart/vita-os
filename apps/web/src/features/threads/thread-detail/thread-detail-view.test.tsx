import type { Doc, Id } from "@convex/_generated/dataModel";

import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render-with-providers";

import { ThreadDetailView } from "./thread-detail-view";

const mocks = vi.hoisted(() => ({
  showDesktopPane: false,
  navigate: vi.fn(),
  threadState: "open" as "open" | "resolved",
}));

vi.mock("@/hooks/use-thread-pane-viewport", () => ({
  useThreadPaneViewport: () => mocks.showDesktopPane,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));

const area = {
  _id: "area1" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Family Health",
  slug: "family-health",
  condition: "needs_attention",
  order: 0,
  createdAt: 0,
} satisfies Doc<"areas">;

const thread = {
  _id: "thread1" as Id<"threads">,
  _creationTime: 0,
  userId: "user1",
  title: "Sister's front teeth",
  slug: "sister-s-front-teeth",
  summary: "Waiting for the specialist's opinion.",
  areaId: area._id,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies Doc<"threads">;

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (query: unknown) => {
    const name = getFunctionName(query as never);
    if (name === "areas:getBySlug") return area;
    if (name === "areas:list") return [area];
    if (name === "threads:getBySlug") {
      return { ...thread, state: mocks.threadState };
    }
    if (name === "activityLogs:listByThread") return [];
    return undefined;
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => {
    const mutation = vi.fn().mockResolvedValue(undefined);
    return Object.assign(mutation, {
      withOptimisticUpdate: () => mutation,
    });
  },
}));

function renderThreadDetail(threadSlug = "sister-s-front-teeth") {
  return render(
    <ThreadDetailView areaSlug="family-health" threadSlug={threadSlug} />,
  );
}

describe("ThreadDetailView", () => {
  beforeEach(() => {
    mocks.showDesktopPane = false;
    mocks.navigate.mockReset();
    mocks.threadState = "open";
  });

  it("opens Thread detail as a near-full bottom drawer below the pane breakpoint", async () => {
    renderThreadDetail();

    const drawer = await screen.findByRole("dialog", {
      name: "Sister's front teeth",
    });

    expect(drawer).toHaveAttribute("data-vaul-drawer-direction", "bottom");
    expect(drawer).toHaveClass("h-[90dvh]", "max-h-[90dvh]");
    expect(screen.getByRole("button", { name: "Close thread" })).toBeVisible();
  });

  it("leaves the narrow Thread route after its close animation", async () => {
    renderThreadDetail();

    await screen.findByRole("dialog", { name: "Sister's front teeth" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    expect(mocks.navigate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/$areaSlug",
        params: { areaSlug: "family-health" },
        replace: true,
      });
    });
  });

  it("opens a fresh Drawer shell when the Thread route changes", async () => {
    const { rerender } = renderThreadDetail();

    await screen.findByRole("dialog", { name: "Sister's front teeth" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    rerender(
      <ThreadDetailView areaSlug="family-health" threadSlug="moms-legs" />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Sister's front teeth" }),
      ).toHaveAttribute("data-state", "open");
    });
  });

  it("renders a non-modal complementary pane without a Sheet backdrop", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    const pane = await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    await waitFor(() => expect(pane).toHaveAttribute("data-state", "open"));
    expect(pane).toHaveClass("fixed", "inset-y-0", "h-dvh");
    expect(
      document.querySelector('[data-slot="thread-detail-pane-space"]'),
    ).toHaveClass("data-[state=open]:w-[clamp(28rem,34vw,34rem)]");
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    const controls = screen.getByRole("group", { name: "Thread controls" });
    expect(
      within(controls).getByRole("button", { name: "Thread actions" }),
    ).toBeVisible();
    expect(
      within(controls).getByRole("button", { name: "Close thread" }),
    ).toBeVisible();
  });

  it("leaves the desktop Thread route after the pane width transition", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    expect(mocks.navigate).not.toHaveBeenCalled();

    const paneSpace = document.querySelector(
      '[data-slot="thread-detail-pane-space"]',
    );
    expect(paneSpace).toHaveAttribute("data-state", "closed");
    fireEvent.transitionEnd(paneSpace as Element, { propertyName: "width" });

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/$areaSlug",
      params: { areaSlug: "family-health" },
      replace: true,
    });
  });

  it("keeps the desktop pane open when the Thread route changes", async () => {
    mocks.showDesktopPane = true;
    const { rerender } = renderThreadDetail();
    const pane = await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });
    await waitFor(() => expect(pane).toHaveAttribute("data-state", "open"));

    rerender(
      <ThreadDetailView areaSlug="family-health" threadSlug="moms-legs" />,
    );

    expect(
      screen.getByRole("complementary", { name: "Sister's front teeth" }),
    ).toBe(pane);
    expect(pane).toHaveAttribute("data-state", "open");
  });

  it("restores orientation before presenting attention and continuity", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    const header = screen.getByRole("banner", { name: "Thread header" });
    const summary = screen.getByText("Waiting for the specialist's opinion.");
    const attention = screen.getByRole("region", {
      name: "Thread attention",
    });
    const activity = screen.getByRole("heading", { name: "Activity log" });

    expect(
      within(header).getByRole("button", { name: "Family Health" }),
    ).toBeVisible();
    expect(
      within(header).getByRole("button", { name: "Sister's front teeth" }),
    ).toBeVisible();
    expect(
      within(header).getByRole("button", {
        name: "Waiting for the specialist's opinion.",
      }),
    ).toBeVisible();
    expect(within(attention).getByText("Next Move")).toBeVisible();
    expect(within(attention).getByText("Follow-up")).toBeVisible();
    expect(attention).not.toHaveAttribute("data-slot", "card");
    expect(
      summary.compareDocumentPosition(attention) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      attention.compareDocumentPosition(activity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps a Resolved Thread oriented without active attention controls", async () => {
    mocks.showDesktopPane = true;
    mocks.threadState = "resolved";
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    expect(screen.getByText("Resolved")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Thread attention" }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Thread actions" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Reopen" }),
    ).toBeVisible();
  });
});
