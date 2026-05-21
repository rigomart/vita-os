import type { Doc, Id } from "@convex/_generated/dataModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ThreadAreaSection } from "./thread-area-section";

const healthArea = {
  _id: "area1" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Health",
  slug: "health",
  condition: "healthy",
  order: 0,
  createdAt: 0,
} satisfies Doc<"areas">;

const financesArea = {
  _id: "area2" as Id<"areas">,
  _creationTime: 0,
  userId: "user1",
  name: "Finances",
  slug: "finances",
  condition: "healthy",
  order: 1,
  createdAt: 0,
} satisfies Doc<"areas">;

const thread = {
  _id: "thread1" as Id<"threads">,
  _creationTime: 0,
  userId: "user1",
  title: "Renew passport",
  slug: "renew-passport",
  areaId: healthArea._id,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies Doc<"threads">;

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
});

describe("ThreadAreaSection", () => {
  it("lets the user move a thread to another area", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();

    render(
      <ThreadAreaSection
        areas={[healthArea, financesArea]}
        thread={thread}
        onMove={onMove}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Health" }));
    await user.click(screen.getByRole("button", { name: "Finances" }));

    expect(onMove).toHaveBeenCalledWith(financesArea._id);
  });
});
