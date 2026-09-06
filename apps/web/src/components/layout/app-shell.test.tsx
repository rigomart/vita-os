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
} from "@/test/render-with-providers";

import { AppShell } from "./app-shell";

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
  areaId: area._id,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies ProjectedThread;

// cmdk observes and scrolls its list container; jsdom provides neither.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= vi.fn();

const queryCall = vi.fn<(name: string, args: unknown) => void>();

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (query: unknown, args: unknown) => {
    const name = getFunctionName(query as never);
    queryCall(name, args);
    if (args === "skip") return undefined;
    if (name === "areas:list") return [area];
    if (name === "threads:list") return [thread];
    if (name === "notes:count") return 0;
    return undefined;
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => {
    const mutation = vi.fn().mockResolvedValue({ slug: thread.slug });
    return Object.assign(mutation, {
      withOptimisticUpdate: () => mutation,
    });
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useSearch: () => ({}),
    useMatch: () => undefined,
    useNavigate: () => vi.fn(),
  };
});

// The chrome pulls in auth and theme providers; the shell's own wiring is what
// these tests exercise, so each entry point is reduced to a labelled button.
vi.mock("./app-top-bar", () => ({
  AppTopBar: ({
    onNewNote,
    onOpenPalette,
  }: {
    onNewNote: () => void;
    onOpenPalette: () => void;
  }) => (
    <div>
      <button type="button" onClick={onNewNote}>
        top bar new note
      </button>
      <button type="button" onClick={onOpenPalette}>
        top bar palette
      </button>
    </div>
  ),
}));

vi.mock("./mobile-tab-bar", () => ({
  MobileTabBar: ({
    onNewNote,
    onOpenPalette,
  }: {
    onNewNote: () => void;
    onOpenPalette: () => void;
  }) => (
    <div>
      <button type="button" onClick={onNewNote}>
        mobile new note
      </button>
      <button type="button" onClick={onOpenPalette}>
        mobile palette
      </button>
    </div>
  ),
}));

function subscribedTo(name: string) {
  return queryCall.mock.calls.some(
    ([calledName, args]) => calledName === name && args !== "skip",
  );
}

function renderShell() {
  return render(
    <AppShell>
      <p>page body</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  beforeEach(() => queryCall.mockClear());

  it("mounts no create surface and no palette-only subscription while closed", () => {
    renderShell();

    expect(screen.getByText("page body")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(subscribedTo("areas:list")).toBe(false);
    expect(subscribedTo("threads:list")).toBe(false);
    expect(subscribedTo("notes:count")).toBe(true);
  });

  it.each([
    ["top bar", "top bar new note"],
    ["mobile tab bar", "mobile new note"],
  ])("opens the new note dialog from the %s", async (_source, label) => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: label }));

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

    await user.click(screen.getByRole("button", { name: "top bar new note" }));
    const textarea = await screen.findByPlaceholderText("What's on your mind?");
    await user.type(textarea, "Buy milk");
    expect(textarea).toHaveValue("Buy milk");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("What's on your mind?"),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "top bar new note" }));
    expect(
      await screen.findByPlaceholderText("What's on your mind?"),
    ).toHaveValue("");
  });

  it("opens the palette from the shortcut and only then subscribes to areas and threads", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(subscribedTo("threads:list")).toBe(false);

    await user.keyboard("{Meta>}k{/Meta}");

    expect(
      await screen.findByPlaceholderText("Jump to an area, thread, or action…"),
    ).toBeVisible();
    expect(subscribedTo("areas:list")).toBe(true);
    expect(subscribedTo("threads:list")).toBe(true);
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

    const trigger = screen.getByRole("button", { name: "top bar palette" });
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

    queryCall.mockClear();
    // A re-render after the close must not re-subscribe.
    await user.click(screen.getByRole("button", { name: "top bar new note" }));
    await screen.findByPlaceholderText("What's on your mind?");
    expect(subscribedTo("threads:list")).toBe(false);
  });

  it("opens the create thread dialog from the palette and subscribes to areas only then", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(subscribedTo("areas:list")).toBe(false);

    await user.click(screen.getByRole("button", { name: "top bar palette" }));
    await user.click(await screen.findByText("New thread"));

    expect(await screen.findByLabelText("Title")).toBeVisible();
    expect(subscribedTo("areas:list")).toBe(true);
  });

  it("focuses the new note input when New note is chosen from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "top bar palette" }));
    await user.click(await screen.findByText("New note"));

    const textarea = await screen.findByPlaceholderText("What's on your mind?");
    await waitFor(() => expect(textarea).toHaveFocus());
  });

  it("focuses the thread title input when New thread is chosen from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "top bar palette" }));
    await user.click(await screen.findByText("New thread"));

    const titleInput = await screen.findByLabelText("Title");
    await waitFor(() => expect(titleInput).toHaveFocus());
  });

  it("opens the create area dialog from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "top bar palette" }));
    await user.click(await screen.findByText("New area"));

    expect(await screen.findByLabelText("Name")).toBeVisible();
  });
});
