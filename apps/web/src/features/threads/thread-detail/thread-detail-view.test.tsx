import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

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
  onClose: vi.fn(),
  onThreadLocationChange: vi.fn(),
  threadState: "open" as "open" | "resolved",
  threadExists: true,
  /** Slugs the composite resolves; null lets every slug resolve. */
  knownSlugs: null as string[] | null,
  seen: [] as string[],
}));

vi.mock("@/hooks/use-thread-pane-viewport", () => ({
  useThreadPaneViewport: () => mocks.showDesktopPane,
}));

const area = {
  _id: "area1" as Id<"areas">,
  name: "Family Health",
  slug: "family-health",
  icon: "HeartPulse",
  condition: "needs_attention",
  order: 0,
  createdAt: 0,
} satisfies ProjectedArea;

const thread = {
  _id: "thread1" as Id<"threads">,
  title: "Sister's front teeth",
  slug: "sister-s-front-teeth",
  summary: "Waiting for the specialist's opinion.",
  areaId: area._id,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies ProjectedThread;

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (query: unknown, args: unknown) => {
    const name = getFunctionName(query as never);
    mocks.seen.push(name);
    if (args === "skip") return undefined;
    if (name === "areas:list") return [area];
    if (name === "threads:detailBySlug") {
      const { slug } = args as { slug: string };
      if (mocks.knownSlugs !== null && !mocks.knownSlugs.includes(slug)) {
        return undefined;
      }
      if (!mocks.threadExists) return null;
      return { thread: { ...thread, state: mocks.threadState }, area };
    }
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
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  }),
}));

function renderThreadDetail(
  props: { threadSlug?: string; areaSlug?: string } = {},
) {
  const threadSlug = props.threadSlug ?? "sister-s-front-teeth";
  // Only default areaSlug when the key is absent, so tests can pass an
  // explicit `areaSlug: undefined` to exercise the search-param source.
  const areaSlug = "areaSlug" in props ? props.areaSlug : "family-health";
  return render(
    <ThreadDetailView
      areaSlug={areaSlug}
      threadSlug={threadSlug}
      onClose={mocks.onClose}
      onThreadLocationChange={mocks.onThreadLocationChange}
    />,
  );
}

describe("ThreadDetailView", () => {
  beforeEach(() => {
    mocks.showDesktopPane = false;
    mocks.onClose.mockReset();
    mocks.onThreadLocationChange.mockReset();
    mocks.threadState = "open";
    mocks.threadExists = true;
    mocks.knownSlugs = null;
    mocks.seen = [];
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

  it("closes the narrow Thread pane after its close animation", async () => {
    renderThreadDetail();

    await screen.findByRole("dialog", { name: "Sister's front teeth" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    expect(mocks.onClose).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("opens a fresh Drawer shell when the open Thread changes", async () => {
    const { rerender } = renderThreadDetail();

    await screen.findByRole("dialog", { name: "Sister's front teeth" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    rerender(
      <ThreadDetailView
        areaSlug="family-health"
        threadSlug="moms-legs"
        onClose={mocks.onClose}
        onThreadLocationChange={mocks.onThreadLocationChange}
      />,
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

  it("closes the desktop Thread pane after the pane width transition", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    expect(mocks.onClose).not.toHaveBeenCalled();

    const paneSpace = document.querySelector(
      '[data-slot="thread-detail-pane-space"]',
    );
    expect(paneSpace).toHaveAttribute("data-state", "closed");
    fireEvent.transitionEnd(paneSpace as Element, { propertyName: "width" });

    expect(mocks.onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the desktop pane open when the open Thread changes", async () => {
    mocks.showDesktopPane = true;
    const { rerender } = renderThreadDetail();
    const pane = await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });
    await waitFor(() => expect(pane).toHaveAttribute("data-state", "open"));

    rerender(
      <ThreadDetailView
        areaSlug="family-health"
        threadSlug="moms-legs"
        onClose={mocks.onClose}
        onThreadLocationChange={mocks.onThreadLocationChange}
      />,
    );

    expect(
      screen.getByRole("complementary", { name: "Sister's front teeth" }),
    ).toBe(pane);
    expect(pane).toHaveAttribute("data-state", "open");
  });

  it("subscribes once: the composite plus the shared Area picker list", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    expect(new Set(mocks.seen)).toEqual(
      new Set(["threads:detailBySlug", "areas:list"]),
    );
  });

  it("shows a skeleton, not the previous Thread, while a new slug loads", async () => {
    mocks.showDesktopPane = true;
    mocks.knownSlugs = ["sister-s-front-teeth"];
    const { rerender } = renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    rerender(
      <ThreadDetailView
        areaSlug="family-health"
        threadSlug="moms-legs"
        onClose={mocks.onClose}
        onThreadLocationChange={mocks.onThreadLocationChange}
      />,
    );

    expect(screen.getByTestId("thread-detail-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sister's front teeth" }),
    ).toBeNull();
    expect(
      screen.queryByText("Waiting for the specialist's opinion."),
    ).toBeNull();
  });

  it("renders the Thread without an areaSlug by deriving the area from the thread", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail({ areaSlug: undefined });

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    const header = screen.getByRole("banner", { name: "Thread header" });
    expect(
      within(header).getByRole("button", { name: "Family Health" }),
    ).toBeVisible();
  });

  it("shows not-found when the deep link's Area does not hold the thread", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail({ areaSlug: "another-area" });

    expect(await screen.findByText("Thread not found.")).toBeVisible();
  });

  it("shows a closable not-found state for an unknown thread slug without an area", async () => {
    mocks.showDesktopPane = true;
    mocks.threadExists = false;
    renderThreadDetail({ areaSlug: undefined, threadSlug: "nope" });

    expect(await screen.findByText("Thread not found.")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
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

  it("scrolls only the activity log, keeping header and attention fixed", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    const pane = await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    const composer = screen.getByRole("textbox", {
      name: "Activity log note",
    });
    const scrollRegion = composer.closest(".overflow-y-auto");
    expect(scrollRegion).not.toBeNull();
    expect(pane.contains(scrollRegion)).toBe(true);

    const header = screen.getByRole("banner", { name: "Thread header" });
    const attention = screen.getByRole("region", { name: "Thread attention" });
    expect(scrollRegion!.contains(header)).toBe(false);
    expect(scrollRegion!.contains(attention)).toBe(false);
    // The activity log heading stays visible while entries scroll beneath it.
    expect(
      scrollRegion!.contains(
        screen.getByRole("heading", { name: "Activity log" }),
      ),
    ).toBe(false);
    // No scroll container wraps the whole pane content anymore.
    expect(header.closest(".overflow-y-auto")).toBeNull();
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
