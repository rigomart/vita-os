import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThreadAreaSection } from "./thread-area-section";

const healthArea = {
  _id: "area1" as Id<"areas">,
  name: "Health",
  slug: "health",
  icon: "HeartPulse",
  condition: "healthy",
  order: 0,
  createdAt: 0,
} satisfies ProjectedArea;

const financesArea = {
  _id: "area2" as Id<"areas">,
  name: "Finances",
  slug: "finances",
  icon: "WalletCards",
  condition: "healthy",
  order: 1,
  createdAt: 0,
} satisfies ProjectedArea;

const thread = {
  _id: "thread1" as Id<"threads">,
  title: "Renew passport",
  slug: "renew-passport",
  areaId: healthArea._id,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies ProjectedThread;

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
