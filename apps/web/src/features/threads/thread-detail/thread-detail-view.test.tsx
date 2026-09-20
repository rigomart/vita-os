import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ApplicationClient,
  AreaId,
  AreaSummary,
  Thread,
  ThreadId,
  ThreadNoteId,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { createFakeApplicationClient } from "@vita-os/application/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/components/error-boundary";
import {
  createTestQueryClient,
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
  /** Every operation the rail asked for, in order. */
  calls: [] as string[],
  applicationDetailSlugs: [] as string[],
  applicationActivityThreadIds: [] as string[],
  /** The cursor each Activity Log read carried, so paging is visible. */
  activityCursors: [] as (string | undefined)[],
  activityHasMore: false,
  activityEntries: [] as ActivityLogEntry[],
  completeNextMove: vi.fn(),
  replaceUpNext: vi.fn(),
  updateThread: vi.fn(),
  removeThread: vi.fn(),
}));

vi.mock("@/hooks/use-thread-pane-viewport", () => ({
  useThreadPaneViewport: () => mocks.showDesktopPane,
}));

const area = {
  _id: "area1" as AreaId,
  name: "Family Health",
  slug: "family-health",
  icon: "HeartPulse",
  condition: "needs_attention",
  order: 0,
  createdAt: 0,
} satisfies AreaSummary;

const thread = {
  _id: "thread1" as ThreadId,
  title: "Sister's front teeth",
  slug: "sister-s-front-teeth",
  summary: "Waiting for the specialist's opinion.",
  areaId: area._id,
  state: "open",
  revision: 0,
  order: 0,
  createdAt: 0,
} satisfies Thread;

const threadNote = {
  _id: "thread-note-1" as ThreadNoteId,
  body: "Specialist's opinion pending",
  state: "open" as const,
  createdAt: 0,
  updatedAt: 0,
};

/** A read that never answers, for the tests about what shows while loading. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

/**
 * The application, as this rail sees it.
 *
 * Every operation is recorded, so a test can say what the rail read and wrote
 * without knowing anything about routes, caching, or a transport.
 */
function createApplicationClient(): ApplicationClient {
  return createFakeApplicationClient({
    getThreadDetail: async ({ slug }) => {
      mocks.calls.push("getThreadDetail");
      mocks.applicationDetailSlugs.push(slug);

      if (mocks.detailError) {
        return {
          ok: false,
          error: {
            code: "unavailable",
            message: "The service is temporarily unavailable.",
            retryable: true,
          },
        };
      }
      if (mocks.knownSlugs !== null && !mocks.knownSlugs.includes(slug)) {
        return pending();
      }
      if (!mocks.threadExists) {
        return {
          ok: false,
          error: {
            code: "not_found",
            message: "Thread not found.",
            retryable: false,
          },
        };
      }

      return {
        ok: true,
        value: {
          thread: {
            ...thread,
            state: mocks.threadState,
            ...(mocks.nextMove === undefined
              ? {}
              : { nextMove: mocks.nextMove }),
            ...(mocks.upNext === undefined ? {} : { upNext: mocks.upNext }),
          },
          area,
        },
      };
    },
    getThreadActivityPage: async ({ threadId, cursor }) => {
      mocks.calls.push("getThreadActivityPage");
      mocks.applicationActivityThreadIds.push(threadId);
      mocks.activityCursors.push(cursor);

      return {
        ok: true,
        value: {
          entries: mocks.activityEntries,
          ...(mocks.activityHasMore && cursor === undefined
            ? { nextCursor: "page-2" }
            : {}),
        },
      };
    },
    listAreas: async () => {
      mocks.calls.push("listAreas");
      return { ok: true, value: [area] };
    },
    listOpenThreadNotes: async () => {
      mocks.calls.push("listOpenThreadNotes");
      return { ok: true, value: [] };
    },
    getDoneThreadNotePage: async () => {
      mocks.calls.push("getDoneThreadNotePage");
      return { ok: true, value: { entries: [] } };
    },
    createThreadNote: async () => ({ ok: true, value: threadNote }),
    updateThread: mocks.updateThread,
    replaceUpNext: mocks.replaceUpNext,
    completeNextMove: mocks.completeNextMove,
    removeThread: mocks.removeThread,
  });
}

function renderThreadDetail(
  props: { threadSlug?: string; areaSlug?: string } = {},
) {
  const threadSlug = props.threadSlug ?? "sister-s-front-teeth";
  // Only default areaSlug when the key is absent, so tests can pass an
  // explicit `areaSlug: undefined` to exercise the search-param source.
  const areaSlug = "areaSlug" in props ? props.areaSlug : "family-health";
  const queryClient = createTestQueryClient();
  return {
    ...render(
      <ThreadDetailView
        areaSlug={areaSlug}
        threadSlug={threadSlug}
        onClose={mocks.onClose}
        onThreadLocationChange={mocks.onThreadLocationChange}
      />,
      { applicationClient: createApplicationClient(), queryClient },
    ),
    queryClient,
  };
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
    mocks.calls = [];
    mocks.applicationDetailSlugs = [];
    mocks.applicationActivityThreadIds = [];
    mocks.activityCursors = [];
    mocks.activityHasMore = false;
    mocks.activityEntries = [];
    mocks.replaceUpNext.mockReset().mockResolvedValue({
      ok: true,
      value: thread,
    });
    mocks.updateThread
      .mockReset()
      .mockResolvedValue({ ok: true, value: thread });
    mocks.removeThread
      .mockReset()
      .mockResolvedValue({ ok: true, value: { acknowledged: true } });
    mocks.completeNextMove.mockReset().mockResolvedValue({
      ok: true,
      value: { status: "completed" },
    });
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

    expect(document.querySelector('[data-slot="thread-detail-pane"]')).toBe(
      pane,
    );
    expect(pane).toHaveAttribute("data-state", "open");
  });

  it("subscribes to Thread detail, its Notes, and the shared Area picker list", async () => {
    mocks.showDesktopPane = true;
    renderThreadDetail();

    await screen.findByRole("complementary", {
      name: "Sister's front teeth",
    });

    expect(new Set(mocks.calls)).toEqual(
      new Set([
        "getThreadDetail",
        "listOpenThreadNotes",
        "getDoneThreadNotePage",
        "listAreas",
      ]),
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
      await within(header).findByRole("button", { name: "Family Health" }),
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

  it("stops observing the Thread when the pane unmounts", async () => {
    mocks.showDesktopPane = true;
    const { unmount, queryClient } = renderThreadDetail();
    const observers = () =>
      queryClient
        .getQueryCache()
        .find({ queryKey: ["threads", "detail", thread.slug] })
        ?.getObserversCount() ?? 0;

    await waitFor(() => expect(observers()).toBe(1));
    unmount();

    expect(observers()).toBe(0);
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
    // The Area picker arrives with the Area inventory, a read of its own.
    await within(header).findByRole("button", { name: "Family Health" });
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

    expect(mocks.replaceUpNext).toHaveBeenNthCalledWith(1, {
      threadId: thread._id,
      moves: ["Book the scan", "Collect the results", "Share the report"],
    });
    expect(mocks.replaceUpNext).toHaveBeenNthCalledWith(2, {
      threadId: thread._id,
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
        expectedNextMove: "Call the specialist",
        expectedRevision: thread.revision,
      });
    });
  });

  it("scrolls Notes and the read-only Activity Log below fixed orientation", async () => {
    mocks.showDesktopPane = true;
    mocks.activityHasMore = true;
    mocks.activityEntries = [
      {
        _id: "log1" as ActivityLogEntryId,
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
    await waitFor(() =>
      expect(mocks.activityCursors).toEqual([undefined, "page-2"]),
    );
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
