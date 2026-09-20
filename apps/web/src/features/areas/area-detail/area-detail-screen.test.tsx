import type { AreaId, AreaSummary } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test/render-with-providers";

import { AreaDetailScreen } from "./area-detail-screen";

const mocks = vi.hoisted(() => ({
  /** Slugs the composite resolves; anything else stays loading. */
  knownSlugs: ["family-health"],
  /** Whether a non-skipped `areas.list` subscription has resolved yet. */
  listLoaded: true,
  calls: [] as Array<{
    name: string;
    args: { enabled?: boolean; slug?: string };
  }>,
}));

const area = {
  _id: "area1" as AreaId,
  name: "Family Health",
  slug: "family-health",
  icon: "HeartPulse",
  condition: "healthy",
  order: 0,
  createdAt: 0,
} satisfies AreaSummary;

vi.mock("@vita-os/application", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vita-os/application")>()),
  useAreas: ({ enabled }: { enabled?: boolean } = {}) => {
    mocks.calls.push({ name: "useAreas", args: { enabled } });
    return {
      data: enabled === false || !mocks.listLoaded ? undefined : [area],
    };
  },
  useAreaDetail: (slug: string) => {
    mocks.calls.push({ name: "useAreaDetail", args: { slug } });
    return {
      data: mocks.knownSlugs.includes(slug) ? { area, threads: [] } : undefined,
      isPending: !mocks.knownSlugs.includes(slug),
    };
  },
  useUpdateArea: () => ({ mutateAsync: vi.fn().mockResolvedValue(area) }),
  useRemoveArea: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ acknowledged: true }),
  }),
}));

function renderScreen(areaSlug = "family-health") {
  return render(<AreaDetailScreen areaSlug={areaSlug} />);
}

describe("AreaDetailScreen", () => {
  beforeEach(() => {
    mocks.knownSlugs = ["family-health"];
    mocks.listLoaded = true;
    mocks.calls = [];
  });

  it("renders the page from one Area detail read", () => {
    renderScreen();

    expect(screen.getByText("Family Health")).toBeVisible();

    // The picker's inventory stays unread until the dialog needs it.
    const listReads = mocks.calls.filter(({ name }) => name === "useAreas");
    expect(listReads.length).toBeGreaterThan(0);
    expect(listReads.every(({ args }) => args.enabled === false)).toBe(true);
    expect(mocks.calls.some(({ name }) => name === "useAreaDetail")).toBe(true);
  });

  it("loads the Area picker list only once the create-thread dialog opens", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: /New Thread/ }));

    const listReads = mocks.calls.filter(({ name }) => name === "useAreas");
    expect(listReads.at(-1)?.args.enabled).toBe(true);
  });

  it("holds the create-thread dialog until the Area list resolves, then preselects this Area", async () => {
    mocks.listLoaded = false;
    const user = userEvent.setup();
    const { rerender } = renderScreen();

    await user.click(screen.getByRole("button", { name: /New Thread/ }));
    expect(screen.queryByRole("dialog")).toBeNull();

    mocks.listLoaded = true;
    rerender(<AreaDetailScreen areaSlug="family-health" />);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: /Family Health/ }),
    ).toBeVisible();
  });

  it("shows the skeleton, not the previous Area, while a new slug loads", () => {
    const { rerender } = renderScreen();
    expect(screen.getByText("Family Health")).toBeVisible();

    rerender(<AreaDetailScreen areaSlug="work" />);

    expect(screen.getByTestId("area-detail-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Family Health")).toBeNull();
  });
});
