import type { Doc, Id } from "@convex/_generated/dataModel";

import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { AreaDetailScreen } from "./area-detail-screen";

const mocks = vi.hoisted(() => ({
  /** Slugs the composite resolves; anything else stays loading. */
  knownSlugs: ["family-health"],
  calls: [] as Array<{ name: string; args: unknown }>,
}));

const area = {
  _id: "area1" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Family Health",
  slug: "family-health",
  condition: "healthy",
  order: 0,
  createdAt: 0,
} satisfies Doc<"areas">;

vi.mock("convex-helpers/react/cache/hooks", () => ({
  useQuery: (query: unknown, args: unknown) => {
    const name = getFunctionName(query as never);
    mocks.calls.push({ name, args });
    if (args === "skip") return undefined;
    if (name === "areas:list") return [area];
    if (name === "areas:detailBySlug") {
      const { slug } = args as { slug: string };
      if (!mocks.knownSlugs.includes(slug)) return undefined;
      return { area, threads: [] };
    }
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

function renderScreen(areaSlug = "family-health") {
  return render(<AreaDetailScreen areaSlug={areaSlug} />);
}

describe("AreaDetailScreen", () => {
  beforeEach(() => {
    mocks.knownSlugs = ["family-health"];
    mocks.calls = [];
  });

  it("renders the page from one areas.detailBySlug subscription", () => {
    renderScreen();

    expect(screen.getByText("Family Health")).toBeVisible();

    const listCalls = mocks.calls.filter(({ name }) => name === "areas:list");
    expect(listCalls.length).toBeGreaterThan(0);
    expect(listCalls.every(({ args }) => args === "skip")).toBe(true);
    expect(mocks.calls.some(({ name }) => name === "areas:detailBySlug")).toBe(
      true,
    );
  });

  it("loads the Area picker list only once the create-thread dialog opens", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: /New Thread/ }));

    const listCalls = mocks.calls.filter(({ name }) => name === "areas:list");
    expect(listCalls.at(-1)?.args).not.toBe("skip");
  });

  it("shows the skeleton, not the previous Area, while a new slug loads", () => {
    const { rerender } = renderScreen();
    expect(screen.getByText("Family Health")).toBeVisible();

    rerender(<AreaDetailScreen areaSlug="work" />);

    expect(screen.getByTestId("area-detail-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Family Health")).toBeNull();
  });
});
