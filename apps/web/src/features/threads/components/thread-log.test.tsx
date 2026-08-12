import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedActivityLog } from "@convex/lib/validators";

import userEvent from "@testing-library/user-event";
import { subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

import { ActivityLog } from "./thread-log";

const now = new Date("2026-05-19T12:00:00Z").getTime();

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const note = {
  _id: "log1" as Id<"activityLogs">,
  type: "note",
  content: "Called the clinic",
  createdAt: now,
} satisfies ProjectedActivityLog;

const areaMove = {
  _id: "log2" as Id<"activityLogs">,
  type: "area_move",
  content: 'Moved from "Health" to "Finances"',
  previousValue: "Health",
  newValue: "Finances",
  createdAt: now - 60_000,
} satisfies ProjectedActivityLog;

describe("ActivityLog", () => {
  it("shows Activity Log language and user-facing entry labels", () => {
    render(<ActivityLog logs={[note, areaMove]} onAddNote={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Activity log" })).toHaveClass(
      "text-[11px]",
      "text-muted-foreground",
    );
    expect(screen.getByText("Called the clinic")).toHaveClass(
      "text-[13px]",
      "text-foreground",
    );
    expect(screen.getByText("Health → Finances")).toHaveClass(
      "text-muted-foreground/80",
    );
    expect(screen.getByText("Area")).toBeInTheDocument();
    expect(screen.queryByText("area_move")).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Activity log note" }),
    ).toHaveClass("min-h-10");
    expect(screen.queryByText("Enter")).not.toBeInTheDocument();
    expect(screen.queryByText("Shift + Enter")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add note" })).toHaveClass(
      "bg-secondary",
    );
  });

  it("submits a trimmed note and clears the field", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();

    render(<ActivityLog logs={[]} onAddNote={onAddNote} />);

    const noteInput = screen.getByRole("textbox", {
      name: "Activity log note",
    });
    await user.type(noteInput, "  Called the clinic  ");
    await user.click(screen.getByRole("button", { name: "Add note" }));

    expect(onAddNote).toHaveBeenCalledWith("Called the clinic");
    expect(noteInput).toHaveValue("");
  });

  it("does not submit empty notes", async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn();

    render(<ActivityLog logs={[]} onAddNote={onAddNote} />);

    const addButton = screen.getByRole("button", { name: "Add note" });
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

  it("prevents duplicate notes while submission is pending", async () => {
    const user = userEvent.setup();
    const pendingAdd = deferred();
    const onAddNote = vi.fn(() => pendingAdd.promise);

    render(<ActivityLog logs={[]} onAddNote={onAddNote} />);

    const noteInput = screen.getByRole("textbox", {
      name: "Activity log note",
    });
    await user.type(noteInput, "Called the clinic");
    await user.keyboard("{Enter}{Enter}");

    expect(onAddNote).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Add note" })).toBeDisabled();
    expect(noteInput).toBeDisabled();
    expect(noteInput).toHaveValue("Called the clinic");

    pendingAdd.resolve();

    await waitFor(() => expect(noteInput).toHaveValue(""));
  });

  it("groups entries by day with manual notes visually separated from changes", () => {
    const currentTime = Date.now();
    const yesterday = subDays(new Date(currentTime), 1).getTime();

    render(
      <ActivityLog
        logs={[
          { ...note, createdAt: currentTime },
          { ...areaMove, createdAt: yesterday },
        ]}
        onAddNote={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Yesterday" }),
    ).toBeInTheDocument();
    const noteCard = screen.getByText("Called the clinic").closest("div");
    expect(noteCard).toHaveClass("rounded-md", "border-border");
    expect(screen.getByText("Note")).toHaveClass("uppercase");
    const changeRow = screen.getByText("Health → Finances").closest("div");
    expect(changeRow).toHaveClass("text-muted-foreground");
    expect(changeRow).not.toHaveClass("border-border");
  });

  it("uses a helpful continuity empty state", () => {
    render(<ActivityLog logs={[]} onAddNote={vi.fn()} />);

    expect(
      screen.getByText(
        "Nothing on the timeline yet — the first note starts this Thread's continuity record.",
      ),
    ).toBeInTheDocument();
  });
});
