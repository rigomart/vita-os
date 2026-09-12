import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type {
  ApplicationClient,
  ActivityLogEntry,
  AreaId,
  LiveResource,
  QueryState,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/components/error-boundary";
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
  detailError: false,
  nextMove: undefined as string | undefined,
  upNext: undefined as string[] | undefined,
  /** Slugs the composite resolves; null lets every slug resolve. */
  knownSlugs: null as string[] | null,
  seen: [] as string[],
  applicationDetailSlugs: [] as string[],
  applicationActivityThreadIds: [] as string[],
  activityPagination: "exhausted" as
    | "can_load_more"
    | "loading_more"
    | "exhausted",
  activityEntries: [] as ActivityLogEntry[],
  activityLoadMore: vi.fn(),
  completeNextMove: vi.fn(),
  activeDetailSubscriptions: 0,
  /** One mock per mutation, so a test can assert what the view dispatched. */
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
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
      throw new Error("Thread detail must use the application client");
    }
    return undefined;
  },
}));

function constantResource<T>(snapshot: T): LiveResource<T> {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
  };
}

function detailResource(
  snapshot: QueryState<ThreadDetail>,
): LiveResource<QueryState<ThreadDetail>> {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => {
      mocks.activeDetailSubscriptions += 1;
      return () => {
        mocks.activeDetailSubscriptions -= 1;
      };
    },
  };
}

function createApplicationClient(): ApplicationClient {
  return {
    watchThreadDetail: ({ slug }) => {
      mocks.applicationDetailSlugs.push(slug);
      if (mocks.detailError) {
        return detailResource({
          status: "error",
          error: {
            code: "unavailable",
            message: "The service is temporarily unavailable.",
            retryable: true,
          },
        });
      }
      if (mocks.knownSlugs !== null && !mocks.knownSlugs.includes(slug)) {
        return detailResource({
          status: "loading",
        });
      }
      if (!mocks.threadExists) {
        return detailResource({
          status: "not_found",
        });
      }
      return detailResource({
        status: "ready",
        data: {
          thread: {
            ...thread,
            _id: thread._id as unknown as ThreadId,
            areaId: thread.areaId as unknown as AreaId,
            state: mocks.threadState,
            ...(mocks.nextMove && { nextMove: mocks.nextMove }),
            ...(mocks.upNext && { upNext: mocks.upNext }),
          },
          area: { ...area, _id: area._id as unknown as AreaId },
        },
      });
    },
    watchThreadActivity: ({ threadId }) => {
      mocks.applicationActivityThreadIds.push(threadId);
      return {
        ...constantResource({
          status: "ready" as const,
          data: {
            entries: mocks.activityEntries,
            pagination: mocks.activityPagination,
          },
        }),
        loadMore: mocks.activityLoadMore,
      };
    },
    completeNextMove: mocks.completeNextMove,
  };
}

vi.mock("convex/react", () => ({
  useMutation: (reference: unknown) => {
    const name = getFunctionName(reference as never);
    const existing = mocks.mutations.get(name);
    if (existing) return existing;

    const mutation = Object.assign(vi.fn().mockResolvedValue(undefined), {
      withOptimisticUpdate: () => mutation,
    });
    mocks.mutations.set(name, mutation);
    return mutation;
  },
  usePaginatedQuery: (query: unknown) => {
    const name = getFunctionName(query as never);
    if (name === "activityLogs:listByThread") {
      throw new Error("Activity Log must use the application client");
    }
    return {
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    };
  },
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
    { applicationClient: createApplicationClient() },
  );
}

describe("ThreadDetailView", () => {
  beforeEach(() => {
    mocks.showDesktopPane = false;
    mocks.onClose.mockReset();
    mocks.onThreadLocationChange.mockReset();
    mocks.threadState = "open";
    mocks.threadExists = true;
    mocks.detailError = false;
    mocks.nextMove = undefined;
    mocks.upNext = undefined;
    mocks.knownSlugs = null;
    mocks.seen = [];
    mocks.applicationDetailSlugs = [];
    mocks.applicationActivityThreadIds = [];
    mocks.activityPagination = "exhausted";
    mocks.activityEntries = [];
    mocks.activityLoadMore.mockReset();
    mocks.completeNextMove.mockReset().mockResolvedValue({
      ok: true,
      value: { status: "completed" },
    });
    mocks.activeDetailSubscriptions = 0;
    mocks.mutations.clear();
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

  it("subscribes to Thread detail, its Notes, and the shared Area picker list", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    expect(new Set(mocks.seen)).toEqual(
      new Set(["threadNotes:list", "areas:list"]),
    );
    expect(mocks.applicationDetailSlugs).toEqual([thread.slug]);
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

  it("releases its Thread subscription when the pane unmounts", async () => {
    mocks.showDesktopPane = true;
    const { unmount } = renderThreadDetail();

    await waitFor(() => expect(mocks.activeDetailSubscriptions).toBe(1));
    unmount();

    expect(mocks.activeDetailSubscriptions).toBe(0);
  });

  it("sends application subscription failures to the error boundary", async () => {
    mocks.detailError = true;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <ThreadDetailView
          areaSlug="family-health"
          threadSlug={thread.slug}
          onClose={mocks.onClose}
          onThreadLocationChange={mocks.onThreadLocationChange}
        />
      </AppErrorBoundary>,
      { applicationClient: createApplicationClient() },
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    consoleError.mockRestore();
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
    const notes = screen.getByRole("tab", { name: /Notes/ });
    const activity = screen.getByRole("tab", { name: "Activity" });

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
    expect(
      within(attention).getByRole("textbox", { name: "Next move" }),
    ).toBeVisible();
    expect(
      within(attention).getByRole("button", { name: "Add a follow-up…" }),
    ).toBeVisible();
    expect(attention).not.toHaveAttribute("data-slot", "card");
    expect(
      summary.compareDocumentPosition(attention) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      attention.compareDocumentPosition(notes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notes.compareDocumentPosition(activity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hangs the Thread's Up Next line under the next move, and edits it whole", async () => {
    mocks.showDesktopPane = true;
    mocks.upNext = ["Book the scan", "Collect the results"];
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    await userEvent.click(screen.getByRole("button", { name: /Up Next/ }));
    const moves = within(
      screen.getByRole("list", { name: "Up Next" }),
    ).getAllByRole("listitem");
    expect(
      within(moves[0]!).getByRole("button", { name: "Book the scan" }),
    ).toBeVisible();
    expect(
      within(moves[1]!).getByRole("button", { name: "Collect the results" }),
    ).toBeVisible();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Add an upcoming move" }),
      "Share the report{Enter}",
    );
    await userEvent.click(
      within(moves[0]!).getByRole("button", {
        name: "Remove upcoming move",
      }),
    );

    const replaceUpNext = mocks.mutations.get("threads:replaceUpNext");
    expect(replaceUpNext).toHaveBeenNthCalledWith(1, {
      id: thread._id,
      moves: ["Book the scan", "Collect the results", "Share the report"],
    });
    expect(replaceUpNext).toHaveBeenNthCalledWith(2, {
      id: thread._id,
      moves: ["Collect the results"],
    });
  });

  it("completes the Next Move through the application client", async () => {
    mocks.showDesktopPane = true;
    mocks.nextMove = "Call the specialist";
    renderThreadDetail();

    await userEvent.click(
      await screen.findByRole("button", { name: "Complete next move" }),
    );

    await waitFor(() => {
      expect(mocks.completeNextMove).toHaveBeenCalledWith({
        threadId: thread._id,
        thread: expect.objectContaining({
          _id: thread._id,
          nextMove: "Call the specialist",
        }),
      });
    });
  });

  it("scrolls Notes and the read-only Activity Log below fixed orientation", async () => {
    mocks.showDesktopPane = true;
    mocks.activityPagination = "can_load_more";
    mocks.activityEntries = [
      {
        _id: "log1",
        type: "next_action_change",
        content: "Next move set",
        newValue: "Call the specialist",
        createdAt: Date.now(),
      },
    ];
    renderThreadDetail();

    const pane = await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    const scrollRegion = pane.querySelector(
      '[data-slot="thread-continuity-scroll"]',
    );
    expect(scrollRegion).not.toBeNull();
    // Exactly one region in the pane scrolls.
    expect(pane.querySelectorAll(".overflow-y-auto")).toHaveLength(1);

    const header = screen.getByRole("banner", { name: "Thread header" });
    const attention = screen.getByRole("region", { name: "Thread attention" });
    expect(scrollRegion!.contains(header)).toBe(false);
    expect(scrollRegion!.contains(attention)).toBe(false);
    expect(
      scrollRegion!.contains(
        screen.getByRole("textbox", { name: "New Thread Note" }),
      ),
    ).toBe(true);
    const notesTab = screen.getByRole("tab", { name: /Notes/ });
    expect(scrollRegion!.contains(notesTab)).toBe(false);

    await userEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(
      scrollRegion!.contains(await screen.findByLabelText("Activity log")),
    ).toBe(true);
    expect(
      screen.queryByRole("textbox", { name: "Activity log note" }),
    ).toBeNull();
    expect(mocks.applicationActivityThreadIds).toEqual([thread._id]);
    await userEvent.click(screen.getByRole("button", { name: "Show earlier" }));
    expect(mocks.activityLoadMore).toHaveBeenCalledTimes(1);
    // No scroll container wraps the whole pane content.
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
    expect(screen.queryByRole("textbox", { name: "Next move" })).toBeNull();
    expect(
      screen.getByText(/No next move or follow-up while resolved/),
    ).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Thread actions" }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Reopen" }),
    ).toBeVisible();
  });
});
