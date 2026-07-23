import type { Doc, Id } from "@convex/_generated/dataModel";

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

import { ThreadDetailSheet } from "./thread-detail-sheet";

const mocks = vi.hoisted(() => ({
  isMobile: true,
  navigate: vi.fn(),
  threadState: "open" as "open" | "resolved",
}));

vi.mock("@vita-os/ui/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));

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
  summary: "Waiting for the specialist's opinion.",
  areaId: area._id,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies Doc<"threads">;

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (query: unknown) => {
    const name = getFunctionName(query as never);
    if (name === "areas:getBySlug") return area;
    if (name === "areas:list") return [area];
    if (name === "threads:getBySlug") {
      return { ...thread, state: mocks.threadState };
    }
    if (name === "activityLogs:listByThread") return [];
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
}));

describe("ThreadDetailSheet", () => {
  beforeEach(() => {
    mocks.isMobile = true;
    mocks.navigate.mockReset();
    mocks.threadState = "open";
  });

  it("opens Thread detail as a near-full bottom drawer on mobile", async () => {
    render(
      <ThreadDetailSheet
        areaSlug="family-health"
        threadSlug="sister-s-front-teeth"
      />,
    );

    const drawer = await screen.findByRole("dialog", {
      name: "Sister's front teeth",
    });

    expect(drawer).toHaveAttribute("data-vaul-drawer-direction", "bottom");
    expect(drawer).toHaveClass("h-[90dvh]", "max-h-[90dvh]");
    expect(screen.getByRole("button", { name: "Close thread" })).toBeVisible();
  });

  it("leaves the mobile Thread route after its programmatic close animation", async () => {
    render(
      <ThreadDetailSheet
        areaSlug="family-health"
        threadSlug="sister-s-front-teeth"
      />,
    );

    await screen.findByRole("dialog", {
      name: "Sister's front teeth",
    });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    expect(mocks.navigate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/$areaSlug",
        params: { areaSlug: "family-health" },
        replace: true,
      });
    });
  });

  it("opens a fresh shell when the Thread route changes", async () => {
    const { rerender } = render(
      <ThreadDetailSheet
        areaSlug="family-health"
        threadSlug="sister-s-front-teeth"
      />,
    );

    await screen.findByRole("dialog", { name: "Sister's front teeth" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    rerender(
      <ThreadDetailSheet areaSlug="family-health" threadSlug="moms-legs" />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Sister's front teeth" }),
      ).toHaveAttribute("data-state", "open");
    });
  });

  it("opens a responsive desktop sheet over a soft contextual backdrop", async () => {
    mocks.isMobile = false;

    render(
      <ThreadDetailSheet
        areaSlug="family-health"
        threadSlug="sister-s-front-teeth"
      />,
    );

    const sheet = await screen.findByRole("dialog", {
      name: "Sister's front teeth",
    });
    const backdrop = document.querySelector('[data-slot="sheet-overlay"]');

    expect(sheet).toHaveClass(
      "data-[side=right]:w-[clamp(35rem,45vw,45rem)]",
      "data-[side=right]:sm:max-w-none",
      "data-open:animate-in",
      "data-open:slide-in-from-right-full",
      "data-closed:animate-out",
      "data-closed:slide-out-to-right-full",
    );
    expect(backdrop).toHaveClass(
      "bg-black/20",
      "supports-backdrop-filter:backdrop-blur-none",
    );
    const controls = screen.getByRole("group", { name: "Thread controls" });
    expect(
      within(controls).getByRole("button", { name: "Thread actions" }),
    ).toBeVisible();
    expect(
      within(controls).getByRole("button", { name: "Close thread" }),
    ).toBeVisible();
  });

  it("restores orientation before presenting attention and continuity", async () => {
    mocks.isMobile = false;

    render(
      <ThreadDetailSheet
        areaSlug="family-health"
        threadSlug="sister-s-front-teeth"
      />,
    );

    await screen.findByRole("dialog", { name: "Sister's front teeth" });

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
      within(header).getByRole("button", {
        name: "Sister's front teeth",
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

  it("keeps a Resolved Thread oriented without active attention controls", async () => {
    mocks.isMobile = false;
    mocks.threadState = "resolved";

    render(
      <ThreadDetailSheet
        areaSlug="family-health"
        threadSlug="sister-s-front-teeth"
      />,
    );

    await screen.findByRole("dialog", { name: "Sister's front teeth" });

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
