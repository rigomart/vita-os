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

const today = new Date(2026, 4, 20, 12).getTime();
const yesterday = new Date(2026, 4, 19, 12).getTime();
const tomorrow = new Date(2026, 4, 21, 12).getTime();

function thread(
  id: string,
  title: string,
  fields: Partial<Pick<Doc<"threads">, "followUp" | "nextMove">> = {},
): Doc<"threads"> {
  return {
    _id: id as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title,
    slug: id,
    areaId: "area1" as Id<"areas">,
    state: "open",
    order: 0,
    createdAt: 0,
    ...fields,
  };
}

describe("AreaThreads", () => {
  it("lists threads under the area with Thread language", () => {
    render(
      <AreaThreads
        areaSlug="admin"
        threads={[thread("renew-passport", "Renew passport")]}
        currentDate={today}
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

  it("shows a loading skeleton while Threads are still loading", () => {
    render(
      <AreaThreads
        areaSlug="admin"
        threads={[]}
        currentDate={today}
        isLoading
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(screen.getByTestId("area-threads-skeleton")).toBeVisible();
    expect(
      screen.queryByText("No threads in this area yet."),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state that invites creating a thread", () => {
    render(
      <AreaThreads
        areaSlug="admin"
        threads={[]}
        currentDate={today}
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

  it("marks Threads with a due Follow-up and shows the date for scheduled ones", () => {
    render(
      <AreaThreads
        areaSlug="admin"
        threads={[
          thread("call-clinic", "Call clinic", { followUp: yesterday }),
          thread("renew-passport", "Renew passport", { followUp: tomorrow }),
          thread("sort-receipts", "Sort receipts", { nextMove: "Scan them" }),
        ]}
        currentDate={today}
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(screen.getByText("Follow-up due")).toBeVisible();
    expect(screen.getByText("May 21")).toBeVisible();
    // Ready/open Threads carry no attention badge on the Area page.
    expect(screen.getAllByText(/follow-up due|may 21/i)).toHaveLength(2);
  });
});
