import type { Note, NoteId } from "@vita-os/contracts";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardNote } from "./dashboard-note";

const mocks = vi.hoisted(() => ({
  completeNote: vi.fn(),
  updateNoteBody: vi.fn(),
  updateNoteWhen: vi.fn(),
}));

vi.mock("@/features/notes/use-complete-note", () => ({
  useCompleteNote: () => mocks.completeNote,
}));

vi.mock("@/features/notes/use-update-note-body", () => ({
  useUpdateNoteBody: () => mocks.updateNoteBody,
}));

vi.mock("@/features/notes/use-update-note-when", () => ({
  useUpdateNoteWhen: () => mocks.updateNoteWhen,
}));

const currentDate = new Date(2026, 6, 17, 12).getTime();

function note(body: string, fields: Partial<Note> = {}): Note {
  return {
    _id: "note1" as NoteId,
    body,
    state: "open",
    createdAt: currentDate,
    ...fields,
  };
}

describe("DashboardNote", () => {
  beforeEach(() => {
    mocks.completeNote.mockReset();
    mocks.updateNoteBody.mockReset();
    mocks.updateNoteWhen.mockReset();
  });

  it("edits the body in place instead of opening Notes", async () => {
    const user = userEvent.setup();
    render(
      <DashboardNote
        currentDate={currentDate}
        note={note("Water the plants")}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    const editor = screen.getByRole("textbox", { name: "Edit note body" });
    expect(editor).toHaveValue("Water the plants");

    await user.click(editor);
    await user.clear(editor);
    await user.type(editor, "Water the basil");
    await user.tab();

    expect(mocks.updateNoteBody).toHaveBeenCalledExactlyOnceWith(
      "note1",
      "Water the basil",
    );
  });

  it("still completes the note from the footer", async () => {
    const user = userEvent.setup();
    render(
      <DashboardNote
        currentDate={currentDate}
        note={note("Water the plants")}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark note done" }));

    expect(mocks.completeNote).toHaveBeenCalledExactlyOnceWith("note1");
    expect(mocks.updateNoteBody).not.toHaveBeenCalled();
  });
});
