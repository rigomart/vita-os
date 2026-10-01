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

vi.mock("../../notes/use-complete-note", () => ({
  useCompleteNote: () => mocks.completeNote,
}));

vi.mock("../../notes/use-update-note-body", () => ({
  useUpdateNoteBody: () => mocks.updateNoteBody,
}));

vi.mock("../../notes/use-update-note-when", () => ({
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

  it("opens the Note from a two-line plain text preview", async () => {
    const user = userEvent.setup();
    const onOpenNote = vi.fn();
    const saved = note(
      "# Consultation\n**Next steps** [Clinic](https://example.com)",
    );
    render(
      <DashboardNote
        currentDate={currentDate}
        note={saved}
        onOpenNote={onOpenNote}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    const preview = screen.getByRole("button", {
      name: /Open note: Consultation/,
    });
    expect(preview).toHaveTextContent("Consultation Next steps Clinic");
    expect(preview).not.toHaveTextContent("**");
    expect(preview).toHaveClass("line-clamp-2");
    await user.click(preview);
    expect(onOpenNote).toHaveBeenCalledExactlyOnceWith(saved);
  });

  it("still completes the note from the footer", async () => {
    const user = userEvent.setup();
    const onOpenNote = vi.fn();
    render(
      <DashboardNote
        currentDate={currentDate}
        note={note("Water the plants")}
        onOpenNote={onOpenNote}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark note done" }));

    expect(mocks.completeNote).toHaveBeenCalledExactlyOnceWith("note1");
    expect(mocks.updateNoteBody).not.toHaveBeenCalled();
    expect(onOpenNote).not.toHaveBeenCalled();
  });

  it("dates itself with the board's token and wears no Area-style tag", () => {
    render(
      <DashboardNote
        currentDate={currentDate}
        note={note("Water the plants", {
          attentionDate: currentDate - 2 * 24 * 60 * 60 * 1000,
        })}
        onOpenNote={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Change attention date" }),
    ).toHaveTextContent("−2d");
    expect(screen.queryByText("Note")).not.toBeInTheDocument();
  });
});
