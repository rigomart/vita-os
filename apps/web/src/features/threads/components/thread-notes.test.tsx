import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThreadNote } from "@convex/lib/validators";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { ThreadNotes } from "./thread-notes";

function note(
  id: string,
  fields: Partial<ProjectedThreadNote> = {},
): ProjectedThreadNote {
  return {
    _id: id as Id<"threadNotes">,
    _creationTime: 0,
    body: id,
    state: "open",
    createdAt: 1_000,
    updatedAt: 1_000,
    ...fields,
  };
}

describe("ThreadNotes", () => {
  it("keeps the space below the composer empty while Notes initially load", () => {
    render(
      <ThreadNotes
        notes={undefined}
        doneNotes={[]}
        isDoneExhausted={false}
        isDoneInitialLoading
        onCreate={vi.fn()}
        onUpdateBody={vi.fn()}
        onToggleDone={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByText("Loading Notes…")).toBeNull();
    expect(screen.queryByRole("button", { name: /completed/i })).toBeNull();
  });

  it("captures a multiline body without title, type, or attention date", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);

    render(
      <ThreadNotes
        notes={[]}
        doneNotes={[]}
        onCreate={onCreate}
        onUpdateBody={vi.fn()}
        onToggleDone={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull();
    expect(screen.queryByText(/No open Notes/)).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /attention date/i }),
    ).toBeNull();

    await user.type(
      screen.getByRole("textbox", { name: "New Thread Note" }),
      "Called the clinic{Enter}Waiting for a reply",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreate).toHaveBeenCalledExactlyOnceWith(
      "Called the clinic\nWaiting for a reply",
    );
  });

  it("rests as one line and opens only while there is a draft", async () => {
    const user = userEvent.setup();

    render(
      <ThreadNotes
        notes={[]}
        doneNotes={[]}
        onCreate={vi.fn()}
        onUpdateBody={vi.fn()}
        onToggleDone={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const field = screen.getByRole("textbox", { name: "New Thread Note" });
    // A well, not a card: the composer must never wear the card's frame.
    const composer = field.closest("form")!;
    expect(composer).toHaveClass("rounded-2xl", "bg-muted/30");
    expect(composer).not.toHaveClass("border-2", "bg-surface-2");
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();

    await user.click(field);
    expect(screen.getByRole("button", { name: "Add" })).toBeVisible();

    await user.tab();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();

    await user.type(field, "Half a thought");
    await user.tab();
    expect(screen.getByRole("button", { name: "Add" })).toBeVisible();
  });

  it("edits, completes, and permanently deletes a Note card", async () => {
    const user = userEvent.setup();
    const onUpdateBody = vi.fn();
    const onToggleDone = vi.fn();
    const onRemove = vi.fn();
    const saved = note("Called the clinic");

    render(
      <ThreadNotes
        notes={[saved]}
        doneNotes={[]}
        onCreate={vi.fn()}
        onUpdateBody={onUpdateBody}
        onToggleDone={onToggleDone}
        onRemove={onRemove}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Edit note body" });
    await user.clear(editor);
    await user.type(editor, "Clinic called back");
    await user.tab();
    expect(onUpdateBody).toHaveBeenCalledWith(saved, "Clinic called back");

    await user.click(screen.getByRole("button", { name: "Mark note done" }));
    expect(onToggleDone).toHaveBeenCalledWith(saved);

    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onRemove).toHaveBeenCalledWith(saved);
  });

  it("keeps Done Notes in collapsed history and can reopen them", async () => {
    const user = userEvent.setup();
    const onToggleDone = vi.fn();
    const done = note("Finished note", {
      state: "done",
      completedAt: 2_000,
      updatedAt: 2_000,
    });

    render(
      <ThreadNotes
        notes={[]}
        doneNotes={[done]}
        onCreate={vi.fn()}
        onUpdateBody={vi.fn()}
        onToggleDone={onToggleDone}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByDisplayValue("Finished note")).toBeNull();
    await user.click(screen.getByRole("button", { name: /completed/i }));
    await user.click(screen.getByRole("button", { name: "Mark note open" }));
    expect(onToggleDone).toHaveBeenCalledWith(done);
  });
});
