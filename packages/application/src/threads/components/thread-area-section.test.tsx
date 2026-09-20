import type { AreaId, AreaSummary, Thread, ThreadId } from "@vita-os/contracts";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThreadAreaSection } from "./thread-area-section";

const healthArea = {
  _id: "area1" as AreaId,
  name: "Health",
  slug: "health",
  icon: "HeartPulse",
  condition: "healthy",
  order: 0,
  createdAt: 0,
} satisfies AreaSummary;

const financesArea = {
  _id: "area2" as AreaId,
  name: "Finances",
  slug: "finances",
  icon: "WalletCards",
  condition: "healthy",
  order: 1,
  createdAt: 0,
} satisfies AreaSummary;

const thread = {
  _id: "thread1" as ThreadId,
  title: "Renew passport",
  slug: "renew-passport",
  areaId: healthArea._id,
  state: "open",
  revision: 0,
  order: 0,
  createdAt: 0,
} satisfies Thread;

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
