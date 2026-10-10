import type { ComponentPropsWithoutRef } from "react";

import { act, render, screen, within } from "@testing-library/react";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "./dashboard-screen";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  /** What each of the Dashboard's three reads answers. */
  areas: undefined as unknown[] | undefined,
  threads: undefined as unknown[] | undefined,
  notes: undefined as unknown[] | undefined,
  /** Which reads the Dashboard performed, so the count stays honest. */
  reads: [] as string[],
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params: _params,
    activeOptions: _activeOptions,
    search: _search,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    to: string;
    params?: unknown;
    activeOptions?: unknown;
    search?: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
  useRouterState: () => undefined,
}));

vi.mock("../../areas/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../areas/hooks")>()),
  useAreas: () => {
    mocks.reads.push("areas");
    return { data: mocks.areas };
  },
}));

vi.mock("../../notes/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../notes/hooks")>()),
  useOpenNotes: () => {
    mocks.reads.push("notes");
    return { data: mocks.notes };
  },
}));

vi.mock("../../threads/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../threads/hooks")>()),
  useOpenThreads: () => {
    mocks.reads.push("threads");
    return { data: mocks.threads };
  },
}));

vi.mock("../../areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

// The board renders real cards here; their writes have their own tests.
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
vi.mock("../../notes/use-update-note-body", () => ({
  useUpdateNoteBody: () => vi.fn(),
}));
vi.mock("../../notes/use-update-note-when", () => ({
  useUpdateNoteWhen: () => vi.fn(),
}));

/** Every read the Dashboard performs, answered empty. */
function answerEmpty() {
  mocks.areas = [];
  mocks.threads = [];
  mocks.notes = [];
}

describe("DashboardScreen", () => {
  // Braces matter: `mockReset` returns the mock, and a function returned from
  // `beforeEach` is run as a teardown hook — with no arguments.
  beforeEach(() => {
    mocks.areas = undefined;
    mocks.threads = undefined;
    mocks.notes = undefined;
    mocks.reads = [];
    mocks.navigate.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it("renders a layout-matched loading state while any source loads", () => {
    mocks.areas = [];
    mocks.threads = [];
    mocks.notes = undefined;
    render(
      <FeedbackProvider
        feedback={{
          success: vi.fn(),
          error: vi.fn(),
          undoable: vi.fn(async () => true),
        }}
      >
        <DashboardScreen />
      </FeedbackProvider>,
    );

    expect(screen.getByTestId("dashboard-overview-skeleton")).toBeVisible();
  });

  it("asks for no Area before it can be used", () => {
    answerEmpty();
    render(
      <FeedbackProvider
        feedback={{
          success: vi.fn(),
          error: vi.fn(),
          undoable: vi.fn(async () => true),
        }}
      >
        <DashboardScreen />
      </FeedbackProvider>,
    );

    expect(screen.getByText("Nothing is asking for you.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Area/ }),
    ).not.toBeInTheDocument();
  });

  it("reads exactly the three inventories", () => {
    answerEmpty();
    render(
      <FeedbackProvider
        feedback={{
          success: vi.fn(),
          error: vi.fn(),
          undoable: vi.fn(async () => true),
        }}
      >
        <DashboardScreen />
      </FeedbackProvider>,
    );

    expect([...new Set(mocks.reads)].sort()).toEqual([
      "areas",
      "notes",
      "threads",
    ]);
  });

  it("reclassifies the board when the day rolls over, without requerying", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 17, 23, 30));
    // Due tomorrow at 23:30 tonight; due today once midnight passes.
    mocks.areas = [
      {
        _id: "health",
        name: "Health",
        slug: "health",
        icon: "HeartPulse",
        order: 0,
      },
    ];
    mocks.threads = [
      {
        _id: "thread1",
        title: "Dentist",
        slug: "dentist",
        areaId: "health",
        order: 0,
        state: "open",

        tasks: [
          {
            _id: "task1",
            text: "Call the dentist",
            date: new Date(2026, 6, 18, 9).getTime(),
          },
        ],
        createdAt: 0,
      },
    ];
    mocks.notes = [];
    render(
      <FeedbackProvider
        feedback={{
          success: vi.fn(),
          error: vi.fn(),
          undoable: vi.fn(async () => true),
        }}
      >
        <DashboardScreen />
      </FeedbackProvider>,
    );

    const group = (name: string) => screen.queryByRole("region", { name });

    expect(within(group("Tomorrow")!).getByText("Dentist")).toBeVisible();
    expect(group("Today")).toBeNull();
    const readsBefore = new Set(mocks.reads).size;

    act(() => vi.advanceTimersByTime(30 * 60_000));

    expect(within(group("Today")!).getByText("Dentist")).toBeVisible();
    expect(group("Tomorrow")).toBeNull();
    // The rollover reclassifies what is already read; it reads nothing new.
    expect(new Set(mocks.reads).size).toBe(readsBefore);
  });
});
