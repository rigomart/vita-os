import type { Doc, Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecentTasksList } from "./recent-tasks-list";

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

function task(
  id: string,
  text: string,
  createdAt: number,
  state: Doc<"tasks">["state"] = "open",
  when?: number,
): Doc<"tasks"> {
  return {
    _id: id as Id<"tasks">,
    _creationTime: createdAt,
    userId: "user1",
    text,
    state,
    createdAt,
    when,
    completedAt: state === "done" ? createdAt + 1 : undefined,
  };
}

describe("RecentTasksList", () => {
  const may18_2026 = new Date(2026, 4, 18, 12).getTime();
  const may19_2026 = new Date(2026, 4, 19, 12).getTime();

  it("surfaces Open Tasks with When today or earlier as due Tasks", () => {
    render(
      <RecentTasksList
        tasks={[
          task("task1", "Call clinic", 3, "open", may18_2026),
          task("task2", "Renew passport", 2, "open", may19_2026),
          task("task3", "Pay utility bill", 1, "open", may18_2026 - 86_400_000),
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
      <RecentTasksList
        tasks={[
          task("task1", "Call clinic", 4, "open", may18_2026),
          task("task2", "Renew passport", 3, "open", may19_2026),
          task("task3", "Sort receipts", 2),
          task("task4", "Archived errand", 1, "done"),
        ]}
        referenceDate={may18_2026}
      />,
    );

    expect(screen.getByText("2 more Open Tasks in Inbox")).toBeVisible();
  });

  it("summarizes Open Tasks instead of rendering the full Inbox when none are due", () => {
    render(
      <RecentTasksList
        tasks={[
          task("task1", "Renew passport", 3, "open", may19_2026),
          task("task2", "Sort receipts", 2),
          task("task3", "Archived errand", 1, "done"),
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
      <RecentTasksList
        tasks={[
          task("task1", "First active task", 7),
          task("task2", "Completed task", 6, "done"),
          task("task3", "Second active task", 5),
          task("task4", "Third active task", 4),
          task("task5", "Fourth active task", 3),
          task("task6", "Fifth active task", 2),
          task("task7", "Sixth active task", 1),
        ]}
      />,
    );

    expect(screen.getByText("6 Open Tasks in Inbox")).toBeVisible();
    expect(screen.queryByText("First active task")).not.toBeInTheDocument();
    expect(screen.queryByText("Fifth active task")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed task")).not.toBeInTheDocument();
    expect(screen.queryByText("Sixth active task")).not.toBeInTheDocument();

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
