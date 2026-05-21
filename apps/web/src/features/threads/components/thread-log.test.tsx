import type { Doc, Id } from "@convex/_generated/dataModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityLog } from "./thread-log";

const now = new Date("2026-05-19T12:00:00Z").getTime();

const note = {
  _id: "log1" as Id<"activityLogs">,
  _creationTime: 0,
  userId: "user1",
  threadId: "thread1" as Id<"threads">,
  type: "note",
  content: "Called the clinic",
  createdAt: now,
} satisfies Doc<"activityLogs">;

const areaMove = {
  _id: "log2" as Id<"activityLogs">,
  _creationTime: 0,
  userId: "user1",
  threadId: "thread1" as Id<"threads">,
  type: "area_move",
  content: 'Moved from "Health" to "Finances"',
  createdAt: now - 60_000,
} satisfies Doc<"activityLogs">;

describe("ActivityLog", () => {
  it("shows Activity Log language and user-facing entry labels", () => {
    render(<ActivityLog logs={[note, areaMove]} onAddNote={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Activity log" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Called the clinic")).toBeInTheDocument();
    expect(
      screen.getByText('Moved from "Health" to "Finances"'),
    ).toBeInTheDocument();
    expect(screen.getByText("Area")).toBeInTheDocument();
    expect(screen.queryByText("area_move")).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Activity log note" }),
    ).toBeInTheDocument();
  });

  it("submits a trimmed note and clears the field", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();

    render(<ActivityLog logs={[]} onAddNote={onAddNote} />);

    const noteInput = screen.getByRole("textbox", {
      name: "Activity log note",
    });
    await user.type(noteInput, "  Called the clinic  ");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onAddNote).toHaveBeenCalledWith("Called the clinic");
    expect(noteInput).toHaveValue("");
  });

  it("does not submit empty notes", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();

    render(<ActivityLog logs={[]} onAddNote={onAddNote} />);

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();

    await user.type(
      screen.getByRole("textbox", { name: "Activity log note" }),
      "   ",
    );

    expect(addButton).toBeDisabled();
    expect(onAddNote).not.toHaveBeenCalled();
  });

  it("submits with Enter while preserving Shift+Enter line breaks", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();

    render(<ActivityLog logs={[]} onAddNote={onAddNote} />);

    const noteInput = screen.getByRole("textbox", {
      name: "Activity log note",
    });
    await user.type(noteInput, "Line one");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(noteInput, "Line two");
    expect(noteInput).toHaveValue("Line one\nLine two");

    await user.keyboard("{Enter}");

    expect(onAddNote).toHaveBeenCalledWith("Line one\nLine two");
    expect(noteInput).toHaveValue("");
  });
});
