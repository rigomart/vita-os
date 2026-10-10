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
import { findNoteEditor, noteText, typeInNote } from "../test/note-editor";
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
  order: 0,
  createdAt: 0,
} satisfies AreaSummary;

const thread = {
  _id: "thread1" as ThreadId,
  title: "Sister's front teeth",
  slug: "sister-s-front-teeth",
  areaId: area._id,
  state: "open",

  order: 0,
  createdAt: 0,
} satisfies Thread;

const archivedNote = {
  _id: "note-archived" as NoteId,
  body: "Passport photo sizes",
  state: "done" as const,
  completedAt: 1,
  createdAt: 0,
  updatedAt: 1,
};

const newNote = {
  _id: "note1" as NoteId,
  body: "Buy milk",
  state: "open" as const,
  createdAt: 0,
  updatedAt: 0,
};

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useSearch: () => mocks.search,
    useMatch: () => undefined,
    useNavigate: () => mocks.navigate,
  };
});

// The chrome pulls in auth and theme providers; these tests are about the
// shell's wiring, so each entry point becomes a labelled button.
vi.mock("./action-bar", () => ({ ActionBar: () => null }));
vi.mock("./sky-header", () => ({
  SkyHeader: ({
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
  getDoneNotePage: Mock<ApplicationClient["getDoneNotePage"]>;
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
    getDoneNotePage: vi.fn<ApplicationClient["getDoneNotePage"]>(async () => ({
      ok: true,
      value: { entries: [archivedNote] },
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
        listResolvedThreads: async () => ({ ok: true, value: [] }),
      }),
    },
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    mocks.search = {};
  });

  it("lets the page keep its width and offsets only --rail while a thread is open", async () => {
    mocks.search = { thread: thread.slug };
    renderShell();

    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="thread-detail-pane"]'),
      ).not.toBeNull();
    });

    const shell = screen
      .getByText("page body")
      .closest("[style]") as HTMLElement;
    expect(shell.style.getPropertyValue("--rail")).toBe(
      "clamp(28rem,34vw,34rem)",
    );
    // The rail is fixed and nothing in the flow reserves its width.
    expect(
      document.querySelector('[data-slot="thread-detail-pane-space"]'),
    ).toBeNull();
  });

  it("zeroes --rail while no thread is open", () => {
    renderShell();

    const shell = screen
      .getByText("page body")
      .closest("[style]") as HTMLElement;
    expect(shell.style.getPropertyValue("--rail")).toBe("0px");
  });

  it("sends the legacy Notes panel param to the Notes filter, keeping the Thread", async () => {
    mocks.navigate.mockClear();
    mocks.search = { inbox: true, thread: thread.slug, area: area.slug };
    renderShell();

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    const redirect = mocks.navigate.mock.calls[0]?.[0] as {
      to: string;
      replace: boolean;
      search: (previous: object) => object;
    };
    expect(redirect.to).toBe("/");
    expect(redirect.replace).toBe(true);
    expect(redirect.search(mocks.search)).toEqual({
      thread: thread.slug,
      area: undefined,
      show: "notes",
      inbox: undefined,
    });
  });

  it("mounts no create surface and no palette-only subscription while closed", () => {
    renderShell();

    expect(screen.getByText("page body")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // The Areas back the filter shortcuts, so the shell reads them itself.
    expect(read("listAreas")).toBe(true);
    expect(read("listOpenThreads")).toBe(false);
    // No badge: the shell counts nothing, and History is read only on demand.
    expect(read("countOpenNotes")).toBe(false);
    expect(read("getDoneNotePage")).toBe(false);
  });

  it("opens an Archived Note from History over the page, without Add to thread", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByRole("button", { name: "History" }));
    await user.click(
      await screen.findByRole("option", { name: /Passport photo sizes/ }),
    );

    const view = await screen.findByRole("dialog", { name: "Note" });
    expect(screen.getByText("page body")).toBeInTheDocument();
    expect(view).toContainElement(await findNoteEditor());
    expect(view).toHaveTextContent("Passport photo sizes");
    expect(
      screen.getByRole("button", { name: "Unarchive" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      await screen.findByRole("menuitem", { name: "Delete note" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Add to thread/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /New thread from note/ }),
    ).not.toBeInTheDocument();
  });

  it("filters the Dashboard to the Nth Area on a bare digit, and back to All on 0", async () => {
    const user = userEvent.setup();
    mocks.navigate.mockClear();
    renderShell();
    await waitFor(() => expect(read("listAreas")).toBe(true));

    await waitFor(async () => {
      mocks.navigate.mockClear();
      await user.keyboard("1");
      expect(mocks.navigate).toHaveBeenCalled();
    });
    const toArea = mocks.navigate.mock.calls[0]?.[0] as {
      to: string;
      search: (previous: object) => object;
    };
    expect(toArea.to).toBe("/");
    expect(toArea.search({ thread: "x" })).toEqual({
      thread: "x",
      area: area.slug,
      show: undefined,
    });

    mocks.navigate.mockClear();
    await user.keyboard("0");
    const toAll = mocks.navigate.mock.calls[0]?.[0] as {
      search: (previous: object) => object;
    };
    expect(toAll.search({ area: area.slug })).toEqual({
      area: undefined,
      show: undefined,
    });

    // A digit replaces the Notes filter too: the two never coexist.
    mocks.navigate.mockClear();
    await user.keyboard("1");
    const fromNotes = mocks.navigate.mock.calls[0]?.[0] as {
      search: (previous: object) => object;
    };
    expect(fromNotes.search({ show: "notes" })).toEqual({
      area: area.slug,
      show: undefined,
    });

    mocks.navigate.mockClear();
    await user.keyboard("2");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("opens the new note dialog from the chrome", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome new note" }));

    expect(await findNoteEditor()).toBeVisible();
  });

  it("opens the new note dialog from the q shortcut", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.keyboard("q");

    expect(await findNoteEditor()).toBeVisible();
  });

  it.each([["{Control>}q{/Control}"], ["{Meta>}q{/Meta}"], ["{Alt>}q{/Alt}"]])(
    "leaves %s to the browser instead of opening the new note dialog",
    async (keys) => {
      const user = userEvent.setup();
      renderShell();

      await user.keyboard(keys);

      expect(
        screen.queryByRole("textbox", { name: "Note body" }),
      ).not.toBeInTheDocument();
    },
  );

  it("resets new note input between openings", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome new note" }));
    typeInNote(await findNoteEditor(), "Buy milk");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "Note body" }),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "chrome new note" }));
    expect(noteText(await findNoteEditor())).toBe("");
  });

  it("opens the palette from the shortcut and only then subscribes to areas and threads", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(read("listOpenThreads")).toBe(false);

    await user.keyboard("{Meta>}k{/Meta}");

    expect(
      await screen.findByPlaceholderText("Jump to a thread, area, or action…"),
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
      await screen.findByPlaceholderText("Jump to a thread, area, or action…"),
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
      screen.queryByPlaceholderText("Jump to a thread, area, or action…"),
    ).not.toBeInTheDocument();
  });

  it("unmounts the palette and its subscriptions when it closes", async () => {
    const user = userEvent.setup();
    renderShell();

    const trigger = screen.getByRole("button", { name: "chrome palette" });
    await user.click(trigger);
    await user.click(
      await screen.findByPlaceholderText("Jump to a thread, area, or action…"),
    );

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Jump to a thread, area, or action…"),
      ).not.toBeInTheDocument(),
    );
    // Dismissing without running an action must still hand focus back.
    await waitFor(() => expect(trigger).toHaveFocus());

    for (const spy of Object.values(reads)) spy.mockClear();
    // A re-render after the close must not read the palette's inventories again.
    await user.click(screen.getByRole("button", { name: "chrome new note" }));
    await findNoteEditor();
    expect(read("listOpenThreads")).toBe(false);
  });

  it("opens the create thread dialog from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("New thread"));

    expect(await screen.findByLabelText("Thread title")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add area" })).toBeVisible();
  });

  it("focuses the new note input when New note is chosen from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("New note"));

    const editor = await findNoteEditor();
    await waitFor(() => expect(editor).toHaveFocus());
  });

  it("focuses the thread title input when New thread is chosen from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("New thread"));

    const titleInput = await screen.findByLabelText("Thread title");
    await waitFor(() => expect(titleInput).toHaveFocus());
  });

  it("opens Manage areas from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "chrome palette" }));
    await user.click(await screen.findByText("Manage areas"));

    expect(
      await screen.findByRole("heading", { name: "Manage areas" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("textbox", { name: `Name of ${area.name}` }),
    ).toHaveValue(area.name);
  });
});
