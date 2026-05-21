import type { Doc, Id } from "@convex/_generated/dataModel";
import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AreaThreads } from "./area-threads";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const thread = {
  _id: "thread1" as Id<"threads">,
  _creationTime: 0,
  userId: "user1",
  title: "Renew passport",
  slug: "renew-passport",
  areaId: "area1" as Id<"areas">,
  state: "open",
  order: 0,
  createdAt: 0,
} satisfies Doc<"threads">;

describe("AreaThreads", () => {
  it("lists threads under the area with Thread language", () => {
    render(
      <AreaThreads
        areaSlug="admin"
        threads={[thread]}
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Threads" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New thread" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Renew passport")).toBeInTheDocument();
  });

  it("shows an empty state that invites creating a thread", () => {
    render(
      <AreaThreads
        areaSlug="admin"
        threads={[]}
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No threads in this area yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeInTheDocument();
  });
});
