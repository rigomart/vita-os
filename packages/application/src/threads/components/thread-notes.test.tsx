import type { ThreadNote, ThreadNoteId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  findNoteEditor,
  noteText,
  replaceNoteText,
  typeInNote,
} from "../../test/note-editor";
import { render, screen, within } from "../../test/render-with-providers";
import { ThreadNotes } from "./thread-notes";

function note(id: string, fields: Partial<ThreadNote> = {}): ThreadNote {
  return {
    _id: id as ThreadNoteId,
    body: id,
    state: "open",
    createdAt: 1000,
    updatedAt: 1000,
    ...fields,
  };
}
const actions = () => ({
  onCreate: vi.fn(),
  onUpdateBody: vi.fn(),
  onToggleArchived: vi.fn(),
  onRemove: vi.fn(),
});

describe("ThreadNotes", () => {
  it("keeps the space below capture empty while Notes initially load", () => {
    render(
      <ThreadNotes
        notes={undefined}
        archivedNotes={[]}
        isArchivedExhausted={false}
        isArchivedInitialLoading
        {...actions()}
      />,
    );
    expect(screen.queryByText("Loading Notes…")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /archived notes/i }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Write a note…" })).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("opens a Thread compose view without a Follow-up date", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    render(
      <ThreadNotes notes={[]} threadTitle="Dad's health" {...callbacks} />,
    );
    await user.click(screen.getByRole("button", { name: "Write a note…" }));
    expect(
      screen.getByRole("dialog", { name: "New note · Dad's health" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /follow-up date/i }),
    ).toBeNull();
    typeInNote(
      await findNoteEditor(),
      "Called the clinic\nWaiting for a reply",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(callbacks.onCreate).toHaveBeenCalledExactlyOnceWith(
      "Called the clinic\nWaiting for a reply",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("opens a read-only preview, edits in the Note view, and deletes there", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    const saved = note("# Clinic\n[Portal](https://example.com)");
    render(<ThreadNotes notes={[saved]} threadTitle="Health" {...callbacks} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Open note: Clinic/ }));
    const dialog = screen.getByRole("dialog");
    const editor = await findNoteEditor();
    expect(dialog).toContainElement(editor);
    expect(within(editor).getByText("Portal")).toBeVisible();
    replaceNoteText(editor, "Clinic called back");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(callbacks.onUpdateBody).toHaveBeenCalledWith(
      saved,
      "Clinic called back",
    );
    expect(noteText(editor)).toBe("Clinic called back");
    await user.click(
      within(dialog).getByRole("button", { name: "More actions" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete note" }),
    );
    expect(callbacks.onRemove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ _id: saved._id }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("archives a card without opening the view", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    const saved = note("Called the clinic");
    render(<ThreadNotes notes={[saved]} {...callbacks} />);
    await user.click(screen.getByRole("button", { name: "Archive note" }));
    expect(callbacks.onToggleArchived).toHaveBeenCalledWith(saved);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps a Note view open when archiving removes its card from Open Notes", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    const saved = note("Consultation");
    const { rerender } = render(<ThreadNotes notes={[saved]} {...callbacks} />);
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    rerender(
      <ThreadNotes
        notes={[]}
        archivedNotes={[{ ...saved, state: "done", completedAt: 2000 }]}
        {...callbacks}
      />,
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeVisible();
  });
  it("keeps Archived notes in collapsed history and can unarchive them", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    const done = note("Finished note", { state: "done", completedAt: 2000 });
    render(<ThreadNotes notes={[]} archivedNotes={[done]} {...callbacks} />);
    expect(
      screen.queryByRole("button", { name: /Open note: Finished note/ }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: /archived notes/i }));
    await user.click(screen.getByRole("button", { name: "Unarchive note" }));
    expect(callbacks.onToggleArchived).toHaveBeenCalledWith(done);
  });
});
