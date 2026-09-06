import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedNote } from "@convex/lib/validators";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxNoteList } from "./inbox-note-list";

const actions = vi.hoisted(() => ({
  handleToggleComplete: vi.fn(),
  isTogglePending: false,
  handleRemove: vi.fn(),
  isDeletePending: false,
  handleUpdateText: vi.fn(),
  isSavingText: false,
  handleUpdateWhen: vi.fn(),
  isWhenPending: false,
}));
vi.mock("@/features/notes/note-row/use-note-row-actions", () => ({
  useNoteRowActions: () => actions,
}));

const today = new Date(2026, 6, 17, 12).getTime();

function note(id: string, fields: Partial<ProjectedNote> = {}): ProjectedNote {
  return {
    _id: id as Id<"tasks">,
    _creationTime: 0,
    body: id,
    state: "open",
    createdAt: 0,
    ...fields,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("InboxNoteList", () => {
  it("shows action-first groups in their shared attention order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(today);

    render(
      <InboxNoteList
        notes={[
          note("Coming up", { when: new Date(2026, 6, 18).getTime() }),
          note("No date", { createdAt: 4 }),
          note("Today", { when: new Date(2026, 6, 17).getTime() }),
          note("Past due", { when: new Date(2026, 6, 16).getTime() }),
        ]}
        doneNotes={[note("Done", { state: "done", completedAt: 8 })]}
      />,
    );

    const pastDue = screen.getByRole("button", { name: "Past due" });
    const todayNote = screen.getByRole("button", { name: "Today" });
    const comingUp = screen.getByRole("button", { name: "Coming up" });
    const noDate = screen.getByRole("button", { name: "No date" });
    const completed = screen.getByRole("button", { name: /completed/i });

    expect(pastDue.compareDocumentPosition(todayNote)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(todayNote.compareDocumentPosition(noDate)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(noDate.compareDocumentPosition(comingUp)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(comingUp.compareDocumentPosition(completed)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("ages today's Note at local midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 17, 23, 30));

    render(
      <InboxNoteList
        notes={[note("Today", { when: new Date(2026, 6, 17).getTime() })]}
      />,
    );

    const rail = () =>
      screen.getByRole("button", { name: "Change attention date" })
        .firstElementChild;

    expect(rail()).toHaveClass("bg-surface-3");

    act(() => vi.advanceTimersByTime(30 * 60_000));

    expect(rail()).toHaveClass("bg-condition-attention-fill");
  });

  it("keeps Completed Notes collapsed when the Open Inbox is clear", async () => {
    const user = userEvent.setup();

    render(
      <InboxNoteList
        notes={[]}
        doneNotes={[
          note("Finished Note", {
            state: "done",
            completedAt: today,
          }),
        ]}
      />,
    );

    expect(screen.getByText("No active Notes")).toBeVisible();
    expect(screen.queryByText("Finished Note")).toBeNull();

    await user.click(screen.getByRole("button", { name: /completed/i }));

    expect(screen.getByText("Finished Note")).toBeVisible();
  });

  it("hides the Completed section once the empty Done page is confirmed", () => {
    render(<InboxNoteList notes={[]} doneNotes={[]} isDoneExhausted={true} />);

    expect(screen.queryByRole("button", { name: /completed/i })).toBeNull();
  });

  it("shows the Completed section while the Done page is still loading", () => {
    render(<InboxNoteList notes={[]} doneNotes={[]} isDoneExhausted={false} />);

    expect(screen.getByRole("button", { name: /completed/i })).toBeVisible();
  });

  it("offers to load more Done Notes when another page is available", async () => {
    const user = userEvent.setup();
    const onLoadMoreDone = vi.fn();

    render(
      <InboxNoteList
        notes={[]}
        doneNotes={[note("Finished Note", { state: "done", completedAt: 8 })]}
        canLoadMoreDone
        onLoadMoreDone={onLoadMoreDone}
      />,
    );

    await user.click(screen.getByRole("button", { name: /completed/i }));
    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMoreDone).toHaveBeenCalledTimes(1);
  });
  it.each(["open", "done"] as const)(
    "can permanently delete a %s Note",
    async (state) => {
      const user = userEvent.setup();
      const saved = note("Saved thought", { state });
      render(
        <InboxNoteList
          notes={state === "open" ? [saved] : []}
          doneNotes={state === "done" ? [saved] : []}
        />,
      );
      if (state === "done")
        await user.click(screen.getByRole("button", { name: /completed/i }));
      expect(screen.queryByRole("button", { name: /process/i })).toBeNull();
      await user.click(screen.getByRole("button", { name: "Delete note" }));
      expect(actions.handleRemove).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(actions.handleRemove).toHaveBeenCalledOnce();
    },
  );

  it("changes and clears an attention date through the calendar", async () => {
    const user = userEvent.setup();
    render(
      <InboxNoteList
        notes={[note("Remember", { when: new Date(2026, 6, 17).getTime() })]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Change attention date" }),
    );
    await user.click(screen.getByRole("button", { name: /July 18/i }));
    expect(actions.handleUpdateWhen).toHaveBeenCalledWith(
      new Date(2026, 6, 18).getTime(),
    );
    await user.click(
      screen.getByRole("button", { name: "Change attention date" }),
    );
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(actions.handleUpdateWhen).toHaveBeenLastCalledWith(undefined);
  });
});
