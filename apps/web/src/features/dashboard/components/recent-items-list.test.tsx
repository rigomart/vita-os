import type { Doc, Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecentItemsList } from "./recent-items-list";

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

function item(
  id: string,
  text: string,
  createdAt: number,
  isCompleted = false,
  date?: number,
): Doc<"items"> {
  return {
    _id: id as Id<"items">,
    _creationTime: createdAt,
    userId: "user1",
    text,
    isCompleted,
    createdAt,
    date,
    completedAt: isCompleted ? createdAt + 1 : undefined,
  };
}

describe("RecentItemsList", () => {
  const may18_2026 = new Date(2026, 4, 18, 12).getTime();
  const may19_2026 = new Date(2026, 4, 19, 12).getTime();

  it("surfaces Open Tasks with When today or earlier as due Tasks", () => {
    render(
      <RecentItemsList
        items={[
          item("item1", "Call clinic", 3, false, may18_2026),
          item("item2", "Renew passport", 2, false, may19_2026),
          item("item3", "Pay utility bill", 1, false, may18_2026 - 86_400_000),
        ]}
        referenceDate={may18_2026}
      />,
    );

    expect(screen.getByRole("heading", { name: /due tasks/i })).toBeVisible();
    expect(screen.getByText("Call clinic")).toBeInTheDocument();
    expect(screen.getByText("Pay utility bill")).toBeInTheDocument();
    expect(screen.queryByText("Renew passport")).not.toBeInTheDocument();
  });

  it("summarizes remaining Open Tasks without counting Done Tasks", () => {
    render(
      <RecentItemsList
        items={[
          item("item1", "Call clinic", 4, false, may18_2026),
          item("item2", "Renew passport", 3, false, may19_2026),
          item("item3", "Sort receipts", 2),
          item("item4", "Archived errand", 1, true),
        ]}
        referenceDate={may18_2026}
      />,
    );

    expect(screen.getByText("2 more Open Tasks in Inbox")).toBeVisible();
  });

  it("summarizes Open Tasks instead of rendering the full Inbox when none are due", () => {
    render(
      <RecentItemsList
        items={[
          item("item1", "Renew passport", 3, false, may19_2026),
          item("item2", "Sort receipts", 2),
          item("item3", "Archived errand", 1, true),
        ]}
        referenceDate={may18_2026}
      />,
    );

    expect(screen.getByText("2 Open Tasks in Inbox")).toBeVisible();
    expect(screen.queryByText("Renew passport")).not.toBeInTheDocument();
    expect(screen.queryByText("Sort receipts")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived errand")).not.toBeInTheDocument();
  });

  it("keeps the Dashboard Task surface read-only with full handling in Inbox", () => {
    render(
      <RecentItemsList
        items={[
          item("item1", "First active item", 7),
          item("item2", "Completed item", 6, true),
          item("item3", "Second active item", 5),
          item("item4", "Third active item", 4),
          item("item5", "Fourth active item", 3),
          item("item6", "Fifth active item", 2),
          item("item7", "Sixth active item", 1),
        ]}
      />,
    );

    expect(screen.getByText("6 Open Tasks in Inbox")).toBeVisible();
    expect(screen.queryByText("First active item")).not.toBeInTheDocument();
    expect(screen.queryByText("Fifth active item")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed item")).not.toBeInTheDocument();
    expect(screen.queryByText("Sixth active item")).not.toBeInTheDocument();

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /process task/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /discard task/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add when/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit task text/i)).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /view all tasks/i }),
    ).toHaveAttribute("href", "/inbox");
  });
});
