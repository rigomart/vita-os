import type { ThreadNote, ThreadNoteId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  findNoteEditor,
  noteText,
  replaceNoteText,
  typeInNote,
} from "../../test/note-editor";
import {
  act,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { ThreadNotes } from "./thread-notes";

function note(id: string): ThreadNote {
  return {
    _id: id as ThreadNoteId,
    body: id,
    createdAt: 1000,
    updatedAt: 1000,
  };
}
const actions = () => ({
  onCreate: vi.fn(),
  onUpdateBody: vi.fn(),
  onRemove: vi.fn(),
});

describe("ThreadNotes", () => {
  it("keeps the space below capture empty while Notes initially load", () => {
    render(<ThreadNotes notes={undefined} {...actions()} />);
    expect(screen.queryByText("Loading Notes…")).toBeNull();
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
  it("offers no Complete, on a line or in the Note view", async () => {
    const user = userEvent.setup();
    render(<ThreadNotes notes={[note("Called the clinic")]} {...actions()} />);
    expect(screen.queryByRole("button", { name: /complete/i })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Open note: Called the clinic" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /complete|reopen/i }),
    ).toBeNull();
  });
  it.each(["at once", "once the view has closed"] as const)(
    "deleting from the Note view focuses the next line when it goes %s",
    async (when) => {
      const user = userEvent.setup();
      let removeLater = () => {};
      function Notes() {
        const [notes, setNotes] = useState([note("First"), note("Second")]);
        return (
          <ThreadNotes
            notes={notes}
            {...actions()}
            onRemove={(note) => {
              const remove = () =>
                setNotes((notes) =>
                  notes.filter((current) => current._id !== note._id),
                );
              if (when === "at once") remove();
              else removeLater = remove;
            }}
          />
        );
      }
      render(<Notes />);
      await user.click(
        screen.getByRole("button", { name: "Open note: First" }),
      );
      await user.click(screen.getByRole("button", { name: "More actions" }));
      await user.click(
        await screen.findByRole("menuitem", { name: "Delete note" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      act(() => removeLater());
      expect(
        screen.getByRole("button", { name: "Open note: Second" }),
      ).toHaveFocus();
    },
  );
});
