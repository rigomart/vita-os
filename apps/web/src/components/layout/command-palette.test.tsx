import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

import { AppShell } from "./app-shell";

const health = {
  _id: "area1" as Id<"areas">,
  name: "Family Health",
  slug: "family-health",
  icon: "HeartPulse",
  condition: "needs_attention",
  standard: "Everyone sees a dentist twice a year.",
  order: 0,
  createdAt: 0,
} satisfies ProjectedArea;

const money = {
  _id: "area2" as Id<"areas">,
  name: "Money",
  slug: "money",
  icon: "WalletCards",
  condition: "healthy",
  order: 1,
  createdAt: 0,
} satisfies ProjectedArea;

// Parked in Money so a query for "Family Health" matches the Area row alone —
// a Thread carries its Area's name as a keyword.
const thread = {
  _id: "thread1" as Id<"threads">,
  title: "Sister's front teeth",
  slug: "sister-s-front-teeth",
  areaId: money._id,
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

const navigate = vi.hoisted(() => vi.fn());
const mutationCall = vi.hoisted(() =>
  vi.fn<(name: string, args: unknown) => void>(),
);

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (query: unknown, args: unknown) => {
    const name = getFunctionName(query as never);
    if (args === "skip") return undefined;
    if (name === "areas:list") return [health, money];
    if (name === "threads:list") return [thread];
    if (name === "tasks:count") return 0;
    return undefined;
  },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName: name } =
    await vi.importActual<typeof import("convex/server")>("convex/server");
  return {
    useMutation: (fn: unknown) => {
      const mutation = vi.fn((args: unknown) => {
        mutationCall(name(fn as never), args);
        return Promise.resolve({ slug: thread.slug });
      });
      return Object.assign(mutation, {
        withOptimisticUpdate: () => mutation,
      });
    },
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useSearch: () => ({}),
    useMatch: () => undefined,
    useNavigate: () => navigate,
  };
});

// Stubbed so the Area the palette scoped the capture to is directly assertable.
vi.mock("@/features/threads/thread-form/create-thread-dialog", () => ({
  CreateThreadDialog: ({ defaultAreaId }: { defaultAreaId?: string }) => (
    <div>create thread dialog for {defaultAreaId ?? "no area"}</div>
  ),
}));

vi.mock("./app-top-bar", () => ({
  AppTopBar: ({ onOpenPalette }: { onOpenPalette: () => void }) => (
    <button type="button" onClick={onOpenPalette}>
      top bar palette
    </button>
  ),
}));

vi.mock("./mobile-tab-bar", () => ({ MobileTabBar: () => null }));

const PLACEHOLDER = "Jump to an area, thread, or action…";

function renderShell() {
  return render(
    <AppShell>
      <p>page body</p>
    </AppShell>,
  );
}

async function openPalette(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "top bar palette" }));
  await screen.findByPlaceholderText(PLACEHOLDER);
}

/** Filters to the one Area row, then drills in with the keyboard. */
async function drillIntoHealth(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(PLACEHOLDER), health.name);
  await user.keyboard("{ArrowRight}");
  await screen.findByText(`Set ${health.name} to Healthy`);
}

describe("CommandPalette area drill-in", () => {
  beforeEach(() => {
    navigate.mockClear();
    mutationCall.mockClear();
  });

  it("still navigates to the Area page when Enter is pressed on an Area row", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.type(screen.getByPlaceholderText(PLACEHOLDER), health.name);
    await user.keyboard("{Enter}");

    expect(navigate).toHaveBeenCalledWith({
      to: "/$areaSlug",
      params: { areaSlug: health.slug },
    });
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(PLACEHOLDER),
      ).not.toBeInTheDocument(),
    );
  });

  it("drills in with ArrowRight and lists the Area's actions", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await drillIntoHealth(user);

    expect(screen.getByText(`Set ${health.name} to Healthy`)).toBeVisible();
    expect(screen.getByText(`Set ${health.name} to Critical`)).toBeVisible();
    expect(screen.getByText(`New Thread in ${health.name}`)).toBeVisible();
    expect(screen.getByText(`Open ${health.name}`)).toBeVisible();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("drills in from the row's actions button without navigating", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.click(
      screen.getByRole("button", { name: `Actions for ${health.name}` }),
    );

    expect(
      await screen.findByText(`Set ${health.name} to Healthy`),
    ).toBeVisible();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("writes the Condition and keeps the palette open", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await drillIntoHealth(user);

    await user.click(screen.getByText(`Set ${health.name} to Critical`));

    expect(mutationCall).toHaveBeenCalledWith("areas:update", {
      condition: "critical",
      id: health._id,
    });
    expect(
      screen.getByPlaceholderText(`Actions in ${health.name}…`),
    ).toBeVisible();
  });

  it("closes the palette and opens the create Thread dialog scoped to the Area", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await drillIntoHealth(user);

    await user.click(screen.getByText(`New Thread in ${health.name}`));

    expect(
      await screen.findByText(`create thread dialog for ${health._id}`),
    ).toBeVisible();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("closes the palette and navigates when the Area is opened", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await drillIntoHealth(user);

    await user.click(screen.getByText(`Open ${health.name}`));

    expect(navigate).toHaveBeenCalledWith({
      to: "/$areaSlug",
      params: { areaSlug: health.slug },
    });
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(PLACEHOLDER),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the Area's Standard on the drill-in page", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await drillIntoHealth(user);

    expect(screen.getByText("Standard")).toBeVisible();
    expect(screen.getByText(health.standard)).toBeVisible();
  });

  it("shows a quiet empty state for an Area with no Standard", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);

    await user.click(
      screen.getByRole("button", { name: `Actions for ${money.name}` }),
    );

    expect(
      await screen.findByText("No Standard yet — write it on the Area page."),
    ).toBeVisible();
  });

  it("pops back to the root list on Backspace with an empty query", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await drillIntoHealth(user);

    await user.keyboard("{Backspace}");

    expect(await screen.findByText("New task")).toBeVisible();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue("");
    expect(
      screen.queryByText(`Set ${health.name} to Healthy`),
    ).not.toBeInTheDocument();
  });

  it("pops back to the root list on Escape instead of closing", async () => {
    const user = userEvent.setup();
    renderShell();
    await openPalette(user);
    await drillIntoHealth(user);

    await user.keyboard("{Escape}");

    expect(await screen.findByText("New task")).toBeVisible();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeVisible();
  });
});
