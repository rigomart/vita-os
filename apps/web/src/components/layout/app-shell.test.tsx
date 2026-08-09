import type { Doc, Id } from "@convex/_generated/dataModel";

import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

import { AppShell } from "./app-shell";

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
  areaId: area._id,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies Doc<"threads">;

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
    if (name === "tasks:count") return 0;
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
    onNewTask,
    onOpenPalette,
  }: {
    onNewTask: () => void;
    onOpenPalette: () => void;
  }) => (
    <div>
      <button type="button" onClick={onNewTask}>
        top bar new task
      </button>
      <button type="button" onClick={onOpenPalette}>
        top bar palette
      </button>
    </div>
  ),
}));

vi.mock("./mobile-tab-bar", () => ({
  MobileTabBar: ({
    onNewTask,
    onOpenPalette,
  }: {
    onNewTask: () => void;
    onOpenPalette: () => void;
  }) => (
    <div>
      <button type="button" onClick={onNewTask}>
        mobile new task
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
    expect(subscribedTo("tasks:count")).toBe(true);
  });

  it.each([
    ["top bar", "top bar new task"],
    ["mobile tab bar", "mobile new task"],
  ])("opens the new task dialog from the %s", async (_source, label) => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: label }));

    expect(
      await screen.findByPlaceholderText("What's on your mind?"),
    ).toBeVisible();
  });

  it("opens the new task dialog from the q shortcut", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.keyboard("q");

    expect(
      await screen.findByPlaceholderText("What's on your mind?"),
    ).toBeVisible();
  });

  it("resets new task input between openings", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "top bar new task" }));
    const textarea = await screen.findByPlaceholderText("What's on your mind?");
    await user.type(textarea, "Buy milk");
    expect(textarea).toHaveValue("Buy milk");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("What's on your mind?"),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "top bar new task" }));
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

  it("unmounts the palette and its subscriptions when it closes", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "top bar palette" }));
    await screen.findByPlaceholderText("Jump to an area, thread, or action…");

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Jump to an area, thread, or action…"),
      ).not.toBeInTheDocument(),
    );

    queryCall.mockClear();
    // A re-render after the close must not re-subscribe.
    await user.click(screen.getByRole("button", { name: "top bar new task" }));
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

  it("opens the create area dialog from the palette", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "top bar palette" }));
    await user.click(await screen.findByText("New area"));

    expect(await screen.findByLabelText("Name")).toBeVisible();
  });
});
