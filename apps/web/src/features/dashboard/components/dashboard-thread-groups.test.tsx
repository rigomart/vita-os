import type { Doc, Id } from "@convex/_generated/dataModel";
import type { ComponentPropsWithoutRef } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DashboardThreadGroups,
  type DashboardThread,
} from "./dashboard-thread-groups";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function area(
  id: string,
  name: string,
  condition: Doc<"areas">["condition"],
): Doc<"areas"> {
  return {
    _id: id as Id<"areas">,
    _creationTime: 1,
    userId: "user1",
    name,
    slug: id,
    condition,
    order: 1,
    createdAt: 1,
  };
}

function thread(
  id: string,
  areaDoc: Doc<"areas">,
  fields: Partial<Pick<DashboardThread, "followUp" | "nextMove">> = {},
): DashboardThread {
  return {
    id,
    key: id,
    area: areaDoc,
    areaId: areaDoc._id,
    areaSlug: areaDoc.slug ?? areaDoc._id,
    threadName: id,
    threadSlug: id,
    ...fields,
  };
}

describe("DashboardThreadGroups", () => {
  const today = new Date(2026, 4, 20, 12).getTime();
  const yesterday = new Date(2026, 4, 19, 12).getTime();
  const tomorrow = new Date(2026, 4, 21, 12).getTime();

  it("shows only attention Threads by default and reveals quiet Threads globally", async () => {
    const user = userEvent.setup();
    const health = area("health", "Health", "healthy");
    const admin = area("admin", "Admin", "needs_attention");

    render(
      <DashboardThreadGroups
        currentDate={today}
        areas={[
          { area: health, threadCount: 2, attentionCount: 2 },
          { area: admin, threadCount: 1, attentionCount: 1 },
        ]}
        threads={[
          thread("Call clinic", health, { followUp: yesterday }),
          thread("Renew passport", admin, { followUp: tomorrow }),
          thread("Send form", health, { nextMove: "Email the PDF" }),
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /health/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
    expect(screen.getByRole("link", { name: /call clinic/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /send form/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /renew passport/i })).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /show 1 quiet thread/i }),
    );

    expect(screen.getByRole("link", { name: /admin/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /renew passport/i })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /hide quiet threads/i }),
    ).toBeVisible();
  });

  it("renders a calm empty state when no Threads need attention", () => {
    const admin = area("admin", "Admin", "healthy");

    render(
      <DashboardThreadGroups
        currentDate={today}
        areas={[{ area: admin, threadCount: 1, attentionCount: 1 }]}
        threads={[thread("Renew passport", admin, { followUp: tomorrow })]}
      />,
    );

    expect(
      screen.getByText(/nothing needs your attention right now/i),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /show 1 quiet thread/i }),
    ).toBeVisible();
  });
});
