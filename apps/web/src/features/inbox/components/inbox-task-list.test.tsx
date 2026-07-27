import type { Doc, Id } from "@convex/_generated/dataModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxTaskList } from "./inbox-task-list";

vi.mock("@/features/tasks/task-row/use-task-row-actions", () => ({
  useTaskRowActions: () => ({
    handleToggleComplete: vi.fn(),
    isTogglePending: false,
    handleRemove: vi.fn(),
    isDiscardPending: false,
    handleUpdateText: vi.fn(),
    isSavingText: false,
    handleUpdateWhen: vi.fn(),
    isWhenPending: false,
  }),
}));

const today = new Date(2026, 6, 17, 12).getTime();

function task(id: string, fields: Partial<Doc<"tasks">> = {}): Doc<"tasks"> {
  return {
    _id: id as Id<"tasks">,
    _creationTime: 0,
    userId: "user1",
    text: id,
    state: "open",
    createdAt: 0,
    ...fields,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("InboxTaskList", () => {
  it("shows action-first groups in their shared attention order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(today);

    render(
      <InboxTaskList
        tasks={[
          task("Coming up", { when: new Date(2026, 6, 18).getTime() }),
          task("No date", { createdAt: 4 }),
          task("Today", { when: new Date(2026, 6, 17).getTime() }),
          task("Past due", { when: new Date(2026, 6, 16).getTime() }),
          task("Done", { state: "done", completedAt: 8 }),
        ]}
      />,
    );

    const pastDue = screen.getByRole("heading", { name: "Past due" });
    const todayHeading = screen.getByRole("heading", { name: "Today" });
    const noDate = screen.getByRole("heading", { name: "No date" });
    const comingUp = screen.getByRole("heading", { name: "Coming up" });
    const completed = screen.getByRole("button", { name: /completed/i });

    expect(pastDue.compareDocumentPosition(todayHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(todayHeading.compareDocumentPosition(noDate)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(noDate.compareDocumentPosition(comingUp)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(comingUp.compareDocumentPosition(completed)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("keeps Completed Tasks collapsed when the Open Inbox is clear", async () => {
    const user = userEvent.setup();

    render(
      <InboxTaskList
        tasks={[
          task("Finished Task", {
            state: "done",
            completedAt: today,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Inbox zero")).toBeVisible();
    expect(screen.queryByText("Finished Task")).toBeNull();

    await user.click(screen.getByRole("button", { name: /completed/i }));

    expect(screen.getByText("Finished Task")).toBeVisible();
  });
});
