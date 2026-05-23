import type { Doc, Id } from "@convex/_generated/dataModel";

import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { TaskRow } from "./task-row";

const task = {
  _id: "task1" as Id<"tasks">,
  _creationTime: 0,
  userId: "user1",
  text: "Buy milk",
  state: "open",
  createdAt: Date.now(),
} satisfies Doc<"tasks">;

describe("TaskRow", () => {
  it("disables the complete checkbox while a toggle is pending", async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();

    render(
      <TaskRow
        task={task}
        onToggleComplete={onToggleComplete}
        onRemove={vi.fn()}
        onUpdateText={vi.fn()}
        onUpdateWhen={vi.fn()}
        isTogglePending
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Mark task done" });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toHaveAttribute("aria-busy", "true");

    await user.click(checkbox);
    expect(onToggleComplete).not.toHaveBeenCalled();
  });

  it("saves edited text once when pressing Enter then blurring", async () => {
    const user = userEvent.setup();
    const onUpdateText = vi.fn();

    render(
      <TaskRow
        task={task}
        onToggleComplete={vi.fn()}
        onRemove={vi.fn()}
        onUpdateText={onUpdateText}
        onUpdateWhen={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: task.text }));
    const input = screen.getByRole("textbox", { name: "Edit task text" });
    fireEvent.change(input, { target: { value: "Buy oat milk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(onUpdateText).toHaveBeenCalledTimes(1);
    expect(onUpdateText).toHaveBeenCalledWith("Buy oat milk");
  });
});
