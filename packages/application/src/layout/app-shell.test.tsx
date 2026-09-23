import type {
  ApplicationClient,
  AreaId,
  AreaSummary,
  NoteId,
  Thread,
  ThreadId,
} from "@vita-os/contracts";
import type { Mock } from "vitest";

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeApplicationClient } from "../test/fake-application-client";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "../test/render-with-providers";
import { AppShell } from "./app-shell";

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
  areaId: area._id,
  state: "open",
  revision: 0,
  order: 0,
  createdAt: 0,
} satisfies Thread;

const newNote = {
  _id: "note1" as NoteId,
  body: "Buy milk",
  state: "open" as const,
  createdAt: 0,
  updatedAt: 0,
};

// cmdk observes and scrolls its list container; jsdom provides neither.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= vi.fn();

const mocks = vi.hoisted(() => ({ search: {} as Record<string, unknown> }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useSearch: () => mocks.search,
    useMatch: () => undefined,
    useNavigate: () => vi.fn(),
  };
});

// The chrome pulls in auth and theme providers; these tests are about the
// shell's wiring, so each entry point becomes a labelled button.
vi.mock("./app-chrome", () => ({
  AppChrome: ({
    onNewNote,
    onOpenPalette,
  }: {
    onNewNote: () => void;
    onOpenPalette: () => void;
  }) => (
    <div>
      <button type="button" onClick={onNewNote}>
        chrome new note
      </button>
      <button type="button" onClick={onOpenPalette}>
        chrome palette
      </button>
    </div>
  ),
}));

// The rail only exists at >=1280px; jsdom reports no width worth believing.
vi.mock("../hooks/use-thread-pane-viewport", () => ({
  useThreadPaneViewport: () => true,
}));

// Covered by its own tests; the shell cares only where it sits.
vi.mock("../inbox/screens/inbox-screen", () => ({
  InboxScreen: () => <p>inbox screen</p>,
}));

/**
 * The shell's own reads, as spies.
 *
 * Which of them the shell actually performs is the behavior under test: the
 * palette's inventories must stay unread until the palette is open.
 */
type ReadSpies = {
  listAreas: Mock<ApplicationClient["listAreas"]>;
  listOpenThreads: Mock<ApplicationClient["listOpenThreads"]>;
  countOpenNotes: Mock<ApplicationClient["countOpenNotes"]>;
};

let reads: ReadSpies;

function read(name: keyof ReadSpies) {
  return reads[name].mock.calls.length > 0;
}

function renderShell() {
  reads = {
    listAreas: vi.fn<ApplicationClient["listAreas"]>(async () => ({
      ok: true,
      value: [area],
    })),
    listOpenThreads: vi.fn<ApplicationClient["listOpenThreads"]>(async () => ({
      ok: true,
      value: [thread],
    })),
    countOpenNotes: vi.fn<ApplicationClient["countOpenNotes"]>(async () => ({
      ok: true,
      value: 0,
    })),
  };

  return render(
    <AppShell>
      <p>page body</p>
    </AppShell>,
    {
      applicationClient: createFakeApplicationClient({
        ...reads,
        getThreadDetail: async () => ({
          ok: true,
          value: { thread, area },
        }),
        getThreadActivityPage: async () => ({
          ok: true,
          value: { entries: [] },
        }),
        listOpenThreadNotes: async () => ({ ok: true, value: [] }),
        getDoneThreadNotePage: async () => ({
          ok: true,
          value: { entries: [] },
        }),
        createNote: async () => ({ ok: true, value: newNote }),
      }),
    },
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    mocks.search = {};
  });

  it("keeps the Notes panel in the column the thread rail pushes", async () => {
    mocks.search = { inbox: true };
    renderShell();

    const positioner = await waitFor(() => {
      const node = document.querySelector(
        '[data-slot="inbox-surface-positioner"]',
      );
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });

    expect(positioner.parentElement).toContainElement(
      screen.getByRole("button", { name: "chrome new note" }),
    );
  });

  it("keeps Notes out of the thread rail when both are open", async () => {
    mocks.search = { inbox: true, thread: thread.slug };
    renderShell();

    const positioner = await waitFor(() => {
      const node = document.querySelector(
        '[data-slot="inbox-surface-positioner"]',
      );
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    const rail = document.querySelector('[data-slot="thread-detail-pane"]');

    // Sibling, not ancestor: the rail's width comes out of the column.
    expect(rail).not.toBeNull();
    expect(rail).not.toContainElement(positioner);
    expect(positioner.parentElement).not.toContainElement(rail as HTMLElement);
  });

  it("mounts no create surface and no palette-only subscription while closed", () => {
    renderShell();

    expect(screen.getByText("page body")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(read("listAreas")).toBe(false);
    expect(read("listOpenThreads")).toBe(false);
    expect(read("countOpenNotes")).toBe(true);
  });

  it("opens the new note dialog from the chrome", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome new note" }));

    expect(
      await screen.findByPlaceholderText("What's on your mind?"),
    ).toBeVisible();
  });

  it("opens the new note dialog from the q shortcut", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.keyboard("q");

    expect(
      await screen.findByPlaceholderText("What's on your mind?"),
    ).toBeVisible();
  });

  it.each([["{Control>}q{/Control}"], ["{Meta>}q{/Meta}"], ["{Alt>}q{/Alt}"]])(
    "leaves %s to the browser instead of opening the new note dialog",
    async (keys) => {
      const user = userEvent.setup();
      renderShell();

      await user.keyboard(keys);

      expect(
        screen.queryByPlaceholderText("What's on your mind?"),
      ).not.toBeInTheDocument();
    },
  );

  it("resets new note input between openings", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome new note" }));
    const textarea = await screen.findByPlaceholderText("What's on your mind?");
    await user.type(textarea, "Buy milk");
    expect(textarea).toHaveValue("Buy milk");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("What's on your mind?"),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "chrome new note" }));
    expect(
      await screen.findByPlaceholderText("What's on your mind?"),
    ).toHaveValue("");
  });

  it("opens the palette from the shortcut and only then subscribes to areas and threads", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(read("listOpenThreads")).toBe(false);

    await user.keyboard("{Meta>}k{/Meta}");

    expect(
      await screen.findByPlaceholderText("Jump to an area, thread, or action…"),
    ).toBeVisible();
    expect(read("listAreas")).toBe(true);
    expect(read("listOpenThreads")).toBe(true);
    expect(screen.getAllByText(area.name).length).toBeGreaterThan(0);
    expect(screen.getByText(thread.title)).toBeVisible();
  });

  it("opens the palette from Ctrl+K with caps lock on", async () => {
    renderShell();

    fireEvent.keyDown(document, { code: "KeyK", key: "K", ctrlKey: true });

    expect(
      await screen.findByPlaceholderText("Jump to an area, thread, or action…"),
    ).toBeVisible();
  });

  it("ignores AltGr+K, which arrives as ctrl and alt together", async () => {
    renderShell();

    fireEvent.keyDown(document, {
      code: "KeyK",
      key: "k",
      ctrlKey: true,
      altKey: true,
    });

    expect(
      screen.queryByPlaceholderText("Jump to an area, thread, or action…"),
    ).not.toBeInTheDocument();
  });

  it("unmounts the palette and its subscriptions when it closes", async () => {
    const user = userEvent.setup();
    renderShell();

    const trigger = screen.getByRole("button", { name: "chrome palette" });
    await user.click(trigger);
    await user.click(
      await screen.findByPlaceholderText("Jump to an area, thread, or action…"),
    );

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Jump to an area, thread, or action…"),
      ).not.toBeInTheDocument(),
    );
    // Dismissing without running an action must still hand focus back.
    await waitFor(() => expect(trigger).toHaveFocus());

    for (const spy of Object.values(reads)) spy.mockClear();
    // A re-render after the close must not read the palette's inventories again.
    await user.click(screen.getByRole("button", { name: "chrome new note" }));
    await screen.findByPlaceholderText("What's on your mind?");
    expect(read("listOpenThreads")).toBe(false);
  });

  it("opens the create thread dialog from the palette and subscribes to areas only then", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(read("listAreas")).toBe(false);

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("New thread"));

    expect(await screen.findByLabelText("Title")).toBeVisible();
    expect(read("listAreas")).toBe(true);
  });

  it("focuses the new note input when New note is chosen from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("New note"));

    const textarea = await screen.findByPlaceholderText("What's on your mind?");
    await waitFor(() => expect(textarea).toHaveFocus());
  });

  it("focuses the thread title input when New thread is chosen from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("New thread"));

    const titleInput = await screen.findByLabelText("Title");
    await waitFor(() => expect(titleInput).toHaveFocus());
  });

  it("opens the create area dialog from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("New area"));

    expect(await screen.findByLabelText("Name")).toBeVisible();
  });
});
