import type {
  AreaId,
  AreaSummary,
  DoneNotePageRequest,
  Note,
  NoteId,
  Thread,
  ThreadId,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { matchesNoteSearch } from "@vita-os/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQuietApplicationClient } from "../test/fake-application-client";
import { render, screen, waitFor } from "../test/render-with-providers";
import { AppShell } from "./app-shell";

const health = {
  _id: "area1" as AreaId,
  name: "Family Health",
  slug: "family-health",
  icon: "HeartPulse",
  order: 0,
  createdAt: 0,
} satisfies AreaSummary;

const money = {
  _id: "area2" as AreaId,
  name: "Money",
  slug: "money",
  icon: "WalletCards",
  order: 1,
  createdAt: 0,
} satisfies AreaSummary;

// Parked in Money so a query for "Family Health" matches the Area row alone —
// a Thread carries its Area's name as a keyword.
const thread = {
  _id: "thread1" as ThreadId,
  title: "Sister's front teeth",
  slug: "sister-s-front-teeth",
  areaId: money._id,
  state: "open",

  order: 0,
  createdAt: 0,
} satisfies Thread;

const resolvedThread = {
  ...thread,
  _id: "resolved1" as ThreadId,
  title: "Sister's checkup",
  slug: "sister-checkup",
  state: "resolved",
} satisfies Thread;

const olderResolvedThread = {
  ...resolvedThread,
  _id: "resolved2" as ThreadId,
  title: "Sister",
  slug: "sister-older",
} satisfies Thread;

function archived(id: string, body: string, completedAt: number): Note {
  return {
    _id: id as NoteId,
    body,
    state: "done",
    completedAt,
    createdAt: 0,
    updatedAt: completedAt,
  };
}

const recentArchived = archived(
  "archived-recent",
  "# Gate code\n**4471** for the side gate",
  new Date(new Date().getFullYear(), 0, 2).getTime(),
);
/** Older than the first page holds: only a search reaches it. */
const oldArchived = archived(
  "archived-old",
  "Passport photo sizes: 35x45mm",
  new Date(2025, 0, 5).getTime(),
);

/** The archived-notes reads History made, in order. */
const archivedReads: DoneNotePageRequest[] = [];

const navigate = vi.hoisted(() => vi.fn());
/** The search the shell and palette read, so a test can put a filter on. */
const search = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("../areas/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../areas/hooks")>()),
  // The palette reads nothing while it is closed.
  useAreas: ({ enabled }: { enabled?: boolean } = {}) => ({
    data: enabled === false ? undefined : [health, money],
  }),
}));

vi.mock("../threads/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../threads/hooks")>()),
  useOpenThreads: ({ enabled }: { enabled?: boolean } = {}) => ({
    data: enabled === false ? undefined : [thread],
  }),
  useResolvedThreads: ({ enabled }: { enabled?: boolean } = {}) => ({
    data:
      enabled === false
        ? undefined
        : [
            resolvedThread,
            olderResolvedThread,
            { ...resolvedThread, _id: "resolved3" as ThreadId, title: "sr" },
          ],
  }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useSearch: () => search.value,
    useMatch: () => undefined,
    useNavigate: () => navigate,
  };
});

// Stubbed so the Area the capture starts in is directly assertable.
vi.mock("../threads/new-thread/new-thread-dialog", () => ({
  NewThreadDialog: ({ defaultAreaId }: { defaultAreaId?: string }) => (
    <div>create thread dialog for {defaultAreaId ?? "no area"}</div>
  ),
}));

vi.mock("./app-chrome", () => ({
  AppChrome: ({ onOpenPalette }: { onOpenPalette: () => void }) => (
    <button type="button" onClick={onOpenPalette}>
      chrome palette
    </button>
  ),
}));

const PLACEHOLDER = "Jump to a thread, area, or action…";

function renderShell() {
  return render(
    <AppShell>
      <p>page body</p>
    </AppShell>,
    {
      applicationClient: createQuietApplicationClient({
        // The service searches every Archived Note; without a search it
        // answers its first page, which holds only the most recent one.
        getDoneNotePage: async (request) => {
          archivedReads.push(request);
          const entries =
            request.query === undefined
              ? [recentArchived]
              : [recentArchived, oldArchived].filter((note) =>
                  matchesNoteSearch(note.body, request.query ?? ""),
                );
          return { ok: true, value: { entries } };
        },
      }),
    },
  );
}

async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "chrome palette" }));
  await screen.findByPlaceholderText(PLACEHOLDER);
}

/** Where a navigation's search function leads from the given search. */
function searchAfter(call: unknown, from: Record<string, unknown> = {}) {
  const { search: next } = call as {
    search: (previous: Record<string, unknown>) => Record<string, unknown>;
  };
  return next(from);
}

function optionLabels() {
  return screen.getAllByRole("option").map((item) => {
    const copy = item.cloneNode(true) as HTMLElement;
    copy.querySelector("[data-slot='command-shortcut']")?.remove();
    return copy.textContent?.replace(/\s+/g, " ").trim() ?? "";
  });
}

describe("CommandPalette", () => {
  beforeEach(() => {
    navigate.mockClear();
    search.value = {};
    archivedReads.length = 0;
  });

  it("lists threads first, then filters, and create actions last", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    const headings = [...document.querySelectorAll("[cmdk-group-heading]")].map(
      (el) => el.textContent,
    );
    expect(headings).toEqual(["Threads", "Filter", "Go to", "Create"]);

    const labels = optionLabels();
    expect(labels[0]).toContain(thread.title);
    expect(labels).toContain(`Filter: ${health.name}`);
    expect(labels).toContain(`Filter: ${money.name}`);
    expect(labels.at(-3)).toBe("New note");
    expect(labels.at(-2)).toBe("New thread");
    expect(labels.at(-1)).toBe("Manage areas");
  });

  it("has no Area pages to drill into", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    expect(
      screen.queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument();
  });

  it("shows only open work until the History chip is selected", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.queryByRole("option", { name: /Sister's checkup/ }),
    ).not.toBeInTheDocument();
    expect(archivedReads).toEqual([]);

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await user.type(input, "Sister");
    expect(optionLabels()).toEqual(["Sister's front teethMoney"]);
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await screen.findByRole("option", { name: /Gate code/ });
    expect(optionLabels()).toEqual([
      "Sister's checkupMoney",
      "SisterMoney",
      "srMoney",
      "Gate code 4471 for the side gateJan 2",
    ]);
    expect(
      [...document.querySelectorAll("[cmdk-group-heading]")].map(
        (el) => el.textContent,
      ),
    ).toEqual(["Resolved threads", "Archived notes"]);
  });

  it("searches every Archived Note on the service, past the first page", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("option", { name: /Gate code/ });
    expect(
      screen.queryByRole("option", { name: /Passport/ }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByRole("combobox"), "35x45mm passport");

    expect(
      await screen.findByRole("option", { name: /Passport photo sizes/ }),
    ).toHaveTextContent("Jan 5, 2025");
    expect(
      screen.queryByRole("option", { name: /Gate code/ }),
    ).not.toBeInTheDocument();
    // Debounced: one read for the settled search, none per keystroke.
    expect(archivedReads.map((read) => read.query)).toEqual([
      undefined,
      "35x45mm passport",
    ]);
  });

  it("loads further search matches and opens an older identical Note", async () => {
    const user = userEvent.setup();
    const notes = Array.from({ length: 21 }, (_, index) =>
      archived(
        `receipt-${index}`,
        "Rent payment receipt",
        new Date(2025, 0, 21 - index).getTime(),
      ),
    );
    render(
      <AppShell>
        <p>page body</p>
      </AppShell>,
      {
        applicationClient: createQuietApplicationClient({
          getDoneNotePage: async ({ cursor }) => ({
            ok: true,
            value:
              cursor === undefined
                ? { entries: notes.slice(0, 20), nextCursor: "older-receipts" }
                : { entries: notes.slice(20) },
          }),
        }),
      },
    );
    await openPalette(user);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findAllByRole("option", { name: /Rent payment receipt/ });
    expect(
      screen.queryByRole("button", { name: "Load more archived notes" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByRole("combobox"), "receipt");
    const loadMore = await screen.findByRole("button", {
      name: "Load more archived notes",
    });
    await user.keyboard("{Home}");
    await user.tab();
    await user.tab();
    expect(loadMore).toHaveFocus();
    await user.keyboard("{Enter}");

    await screen.findByRole("option", {
      name: "Rent payment receiptJan 1, 2025",
    });
    expect(
      screen.getAllByRole("option", { name: /Rent payment receipt/ }),
    ).toHaveLength(21);
    expect(screen.getByRole("combobox")).toHaveValue("receipt");
    expect(
      screen.queryByRole("button", { name: "Load more archived notes" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
    await user.keyboard("{End}{Enter}");
    expect(await screen.findByRole("dialog", { name: "Note" })).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Note" })).toHaveTextContent(
      "Archived Jan 1",
    );
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeVisible();
  });

  it("filters resolved history in resolution order and clears search when returning", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await user.click(screen.getByRole("button", { name: "History" }));
    const input = screen.getByRole("combobox");
    await user.type(input, "Sister");
    expect(optionLabels()).toEqual(["Sister's checkupMoney", "SisterMoney"]);
    await user.clear(input);
    await user.type(input, "Money");
    expect(optionLabels()).toEqual([
      "Sister's checkupMoney",
      "SisterMoney",
      "srMoney",
    ]);
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(optionLabels()[0]).toContain(thread.title);
    expect(screen.getByRole("option", { name: "New thread" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: /Sister's checkup/ }),
    ).not.toBeInTheDocument();
  });

  it("does not match hidden identifiers when searching history", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("option", { name: /Gate code/ });
    const input = screen.getByRole("combobox");
    for (const query of [
      "resolved",
      "thread",
      "resolved1",
      "archived",
      "archived-recent",
    ]) {
      await user.clear(input);
      await user.type(input, query);
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
      expect(screen.getByText("No results found.")).toBeVisible();
    }
  });

  it("opens a resolved Thread in place and preserves the current filter", async () => {
    const user = userEvent.setup();
    search.value = { area: money.slug };
    renderShell();
    await openPalette(user);
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.type(screen.getByRole("combobox"), "checkup");
    await user.click(screen.getByRole("option", { name: /Sister's checkup/ }));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "." }));
    expect(
      searchAfter(navigate.mock.calls[0]?.[0], { area: money.slug }),
    ).toEqual({
      area: money.slug,
      thread: resolvedThread.slug,
    });
    await waitFor(() =>
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument(),
    );
  });

  it("switches with the keyboard without opening a Thread and resets on dismissal", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.type(screen.getByRole("combobox"), "nothing matches");
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "History" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(optionLabels()[0]).toContain(resolvedThread.title);
    await user.keyboard("{Enter}");
    expect(searchAfter(navigate.mock.calls[0]?.[0])).toEqual({
      thread: resolvedThread.slug,
    });
    navigate.mockClear();
    await openPalette(user);
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.keyboard("{Escape}");
    await openPalette(user);
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(optionLabels()[0]).toContain(thread.title);
  });

  it("filters the Dashboard by an Area, keeping the rest of the search", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.click(
      screen.getByRole("option", { name: `Filter: ${health.name}` }),
    );

    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/" }));
    expect(
      searchAfter(navigate.mock.calls[0]?.[0], { thread: "x", show: "notes" }),
    ).toEqual({
      thread: "x",
      area: health.slug,
      show: undefined,
    });
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(PLACEHOLDER),
      ).not.toBeInTheDocument(),
    );
  });

  it("offers Clear filter only while a filter is on", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    expect(
      screen.queryByRole("option", { name: "Clear filter" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    search.value = { area: money.slug };
    await openPalette(user);
    await user.click(screen.getByRole("option", { name: "Clear filter" }));

    expect(
      searchAfter(navigate.mock.calls[0]?.[0], { area: money.slug }),
    ).toEqual({ area: undefined, show: undefined });
    await user.keyboard("{Escape}");

    navigate.mockClear();
    search.value = { show: "notes" };
    await openPalette(user);
    await user.click(screen.getByRole("option", { name: "Clear filter" }));
    expect(searchAfter(navigate.mock.calls[0]?.[0], { show: "notes" })).toEqual(
      { area: undefined, show: undefined },
    );
  });

  it("goes to Notes by filtering the Dashboard to them", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.click(screen.getByRole("option", { name: "Notes" }));

    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: "/" }));
    expect(
      searchAfter(navigate.mock.calls[0]?.[0], {
        thread: "x",
        area: money.slug,
      }),
    ).toEqual({ thread: "x", area: undefined, show: "notes" });
  });

  it("starts a new Thread without an Area under the Notes filter", async () => {
    const user = userEvent.setup();
    search.value = { show: "notes" };
    renderShell();
    await openPalette(user);

    await user.click(screen.getByRole("option", { name: "New thread" }));

    expect(
      await screen.findByText("create thread dialog for no area"),
    ).toBeVisible();
  });

  it("starts a new Thread in the filtered Area, and in none otherwise", async () => {
    const user = userEvent.setup();
    search.value = { area: health.slug };
    renderShell();
    await openPalette(user);

    await user.click(screen.getByRole("option", { name: "New thread" }));

    expect(
      await screen.findByText(`create thread dialog for ${health._id}`),
    ).toBeVisible();
  });

  it("starts a new Thread without an Area when nothing is filtered", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.click(screen.getByRole("option", { name: "New thread" }));

    expect(
      await screen.findByText("create thread dialog for no area"),
    ).toBeVisible();
  });

  it("opens Manage areas", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.click(screen.getByRole("option", { name: "Manage areas" }));

    expect(
      await screen.findByRole("heading", { name: "Manage areas" }),
    ).toBeVisible();
  });

  it("still finds create actions when they are searched for", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), "create");

    expect(screen.getByRole("option", { name: /New note/ })).toBeVisible();
    expect(screen.getByRole("option", { name: /New thread/ })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: new RegExp(thread.title) }),
    ).not.toBeInTheDocument();
  });
});
