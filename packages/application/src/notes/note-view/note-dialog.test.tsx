import userEvent from "@testing-library/user-event";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@vita-os/ui/components/drawer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  findNoteEditor,
  focusNote,
  noteText,
  replaceNoteText,
  typeInNote,
} from "../../test/note-editor";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "../../test/render-with-providers";
import { NoteDialog } from "./note-dialog";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const discardQuestion = "Discard unsaved changes?";

describe("NoteDialog compose", () => {
  it("prevents duplicate note creates while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);
    const onOpenChange = vi.fn();

    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />);

    typeInNote(await findNoteEditor(), "Buy milk");

    const addButton = screen.getByRole("button", { name: "Add" });
    await user.click(addButton);
    await user.click(addButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();

    pendingCreate.resolve();

    await waitFor(() =>
      expect(addButton).toHaveAttribute("aria-busy", "false"),
    );
  });

  it("shows a clear inline error when note creation fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() =>
      Promise.reject(new Error("Could not save note")),
    );

    const { feedback } = render(
      <NoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    );

    typeInNote(await findNoteEditor(), "Buy milk");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save note",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("shows a structural success toast when note creation succeeds", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    const { feedback } = render(
      <NoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    );

    typeInNote(await findNoteEditor(), "Buy milk");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note added"),
    );
  });

  it("starts focused and captures a multiline body with no title or classification", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<NoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    const editor = await findNoteEditor();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(editor).toHaveFocus();
    typeInNote(editor, "A thought\nIts context");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      body: "A thought\nIts context",
      when: undefined,
    });
  });

  it("ticks a task in a draft without saving it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<NoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    const editor = await findNoteEditor();
    typeInNote(editor, "## Clinic\n- [ ] Book bloods\n\nThen call");
    const task = screen.getByRole("checkbox");
    expect(task).not.toBeChecked();
    await user.click(task);
    expect(noteText(editor)).toBe("## Clinic\n- [x] Book bloods\n\nThen call");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });
});

const savedNote = {
  body: "Consultation notes",
  state: "open" as const,
  createdAt: new Date("2026-09-30T12:00:00").getTime(),
};

describe("NoteDialog saved note", () => {
  it("opens rendered, with Thread context and dates", async () => {
    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        threadTitle="Health"
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Health");
    const editor = await findNoteEditor();
    expect(editor).toHaveTextContent("Consultation notes");
    expect(editor).not.toHaveFocus();
    expect(screen.getByText("Added Sep 30")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Read, edit and manage this note. It uses Markdown.",
    );
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("button", { name: "Follow-up date" })).toBeNull();
  });

  it("marks an Archived note in the header and offers Unarchive", () => {
    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{
          ...savedNote,
          state: "done",
          completedAt: new Date("2026-10-01T12:00:00").getTime(),
        }}
        onToggleArchived={vi.fn()}
      />,
    );
    expect(
      document.querySelector('[data-slot="note-archived"]'),
    ).toHaveTextContent("Archived Oct 1");
    expect(screen.getByRole("button", { name: "Unarchive" })).toBeVisible();
    expect(screen.queryByText(/Done/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
  });

  it("offers Archive, never Mark done, on an Open note", () => {
    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onToggleArchived={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Archive" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mark done" })).toBeNull();
  });

  it("saves an edited body with Ctrl+Enter and keeps it while the parent catches up", async () => {
    const onSave = vi.fn(async () => undefined);
    const { feedback, rerender } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onSave={onSave}
      />,
    );
    const editor = await findNoteEditor();
    replaceNoteText(editor, "Updated consultation  ");
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note saved"),
    );
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Updated consultation");
    expect(noteText(editor)).toBe("Updated consultation");
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    rerender(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{ ...savedNote, body: "Updated consultation" }}
        onSave={onSave}
      />,
    );
    expect(noteText(editor)).toBe("Updated consultation");
  });

  it("marks unsaved edits and saves them from the footer", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onSave={onSave}
      />,
    );
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    const editor = await findNoteEditor();
    typeInNote(editor, " changed");
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      "Consultation notes changed",
    );
    await waitFor(() => expect(screen.getByText("Added Sep 30")).toBeVisible());
  });

  it("keeps a failed edit and prevents duplicate saves", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onSave = vi.fn(() => pending.promise);
    const { feedback } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onSave={onSave}
      />,
    );
    const editor = await findNoteEditor();
    typeInNote(editor, " changed");
    const save = screen.getByRole("button", { name: "Save" });
    await user.click(save);
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    typeInNote(editor, " while saving");
    expect(noteText(editor)).toBe("Consultation notes changed");
    pending.reject(new Error("Could not update note"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update note",
    );
    expect(noteText(editor)).toBe("Consultation notes changed");
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("prevents saving an empty edited body", async () => {
    const onSave = vi.fn();
    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onSave={onSave}
      />,
    );
    const editor = await findNoteEditor();
    replaceNoteText(editor, "");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a ticked task straight away without a toast", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    const { feedback } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{ ...savedNote, body: "Before the visit:\n\n- [ ] Bloods" }}
        onSave={onSave}
      />,
    );
    await findNoteEditor();
    await user.click(screen.getByRole("checkbox"));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      "Before the visit:\n\n- [x] Bloods",
    );
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
    expect(feedback.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("restores a ticked task when its save fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.reject(new Error("Offline")));
    const { feedback } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{ ...savedNote, body: "- [ ] Bloods" }}
        onSave={onSave}
      />,
    );
    const editor = await findNoteEditor();
    await user.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(feedback.error).toHaveBeenCalledOnce());
    expect(noteText(editor)).toBe("- [ ] Bloods");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("deletes from the menu without asking and closes", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        onOpenChange={onOpenChange}
        note={savedNote}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete note" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete note" }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("copies the note's Markdown from the menu", async () => {
    const user = userEvent.setup();
    const { feedback } = render(
      <NoteDialog open onOpenChange={vi.fn()} note={savedNote} />,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Copy Markdown" }),
    );
    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Markdown copied"),
    );
    expect(await navigator.clipboard.readText()).toBe("Consultation notes");
  });

  it("guards archiving and reports success only after the callback succeeds", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onToggleArchived = vi.fn(() => pending.promise);
    const { feedback } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onToggleArchived={onToggleArchived}
      />,
    );
    const archive = screen.getByRole("button", { name: "Archive" });
    await user.click(archive);
    await user.click(archive);
    expect(onToggleArchived).toHaveBeenCalledTimes(1);
    expect(archive).toBeDisabled();
    expect(feedback.success).not.toHaveBeenCalled();
    pending.resolve();
    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note archived"),
    );
  });

  it("says Note unarchived after unarchiving", async () => {
    const user = userEvent.setup();
    const { feedback } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{ ...savedNote, state: "done", completedAt: 1 }}
        onToggleArchived={vi.fn(async () => undefined)}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Unarchive" }));
    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note unarchived"),
    );
  });
});

describe("NoteDialog dismissal", () => {
  it("closes an empty compose draft without asking", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes an unchanged saved note on Escape, even while editing", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        onOpenChange={onOpenChange}
        note={savedNote}
        onSave={vi.fn()}
      />,
    );
    const editor = await findNoteEditor();
    focusNote(editor);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks inside the footer before dropping a dirty draft", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    typeInNote(await findNoteEditor(), "Unsaved thought");
    await user.click(screen.getByRole("button", { name: "Close" }));
    const question = screen.getByRole("alertdialog", { name: discardQuestion });
    expect(screen.getByRole("dialog")).toContainElement(question);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(noteText(screen.getByRole("textbox", { name: "Note body" }))).toBe(
      "Unsaved thought",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks before closing a dirty saved-note edit and keeps it on Escape", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        onOpenChange={onOpenChange}
        note={savedNote}
        onSave={vi.fn()}
      />,
    );
    typeInNote(await findNoteEditor(), " changed");
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(noteText(screen.getByRole("textbox", { name: "Note body" }))).toBe(
      "Consultation notes changed",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("guards clicking outside an unsaved compose draft", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    typeInNote(await findNoteEditor(), "Unsaved thought");
    await user.click(document.querySelector('[data-slot="dialog-overlay"]')!);
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("asks before closing when only the Follow-up date has changed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Follow-up date" }));
    const day = screen
      .getAllByRole("button")
      .find(
        (button) =>
          button.getAttribute("data-day") && !button.hasAttribute("disabled"),
      );
    expect(day).toBeDefined();
    await user.click(day!);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("omits Follow-up date for Thread compose and closes after adding", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <NoteDialog
        open
        onOpenChange={onOpenChange}
        threadTitle="Health"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "New note · Health",
    );
    expect(screen.queryByRole("button", { name: "Follow-up date" })).toBeNull();
    typeInNote(await findNoteEditor(), "New consultation");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("NoteDialog on a phone", () => {
  const originalWidth = window.innerWidth;
  beforeEach(() => {
    window.innerWidth = 390;
  });
  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it("asks in place on Escape and keeps the draft when Escape is pressed again", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        note={savedNote}
        onOpenChange={onOpenChange}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-slot",
      "drawer-content",
    );
    typeInNote(await findNoteEditor(), " changed");
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(noteText(screen.getByRole("textbox", { name: "Note body" }))).toBe(
      "Consultation notes changed",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps a dirty drawer in place after a downward header swipe", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    typeInNote(await findNoteEditor(), "Unsaved thought");
    const header = document.querySelector('[data-slot="drawer-header"]')!;
    const drawer = screen.getByRole("dialog");
    const initialTransform = drawer.style.transform;
    fireEvent(
      header,
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
        button: 0,
      }),
    );
    fireEvent(
      header,
      new MouseEvent("pointerup", {
        bubbles: true,
        clientX: 100,
        clientY: 220,
        button: 0,
      }),
    );
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(noteText(screen.getByRole("textbox", { name: "Note body" }))).toBe(
      "Unsaved thought",
    );
    expect(drawer.style.transform).toBe(initialTransform);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("blocks swipe attempts while a note is being added", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={() => pending.promise}
      />,
    );
    typeInNote(await findNoteEditor(), "New thought");
    await user.click(screen.getByRole("button", { name: "Add" }));
    const handle = document.querySelector('[data-slot="drawer-handle"]')!;
    const drawer = screen.getByRole("dialog");
    const initialTransform = drawer.style.transform;
    fireEvent(
      handle,
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
        button: 0,
      }),
    );
    fireEvent(
      handle,
      new MouseEvent("pointerup", {
        bubbles: true,
        clientX: 100,
        clientY: 220,
        button: 0,
      }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(drawer.style.transform).toBe(initialTransform);
    pending.resolve();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("still asks before closing a dirty draft from outside", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    typeInNote(await findNoteEditor(), "Unsaved thought");
    await user.click(document.querySelector('[data-slot="drawer-overlay"]')!);
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("deletes from the menu and closes the drawer", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        note={savedNote}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete note" }),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("discards a nested draft without closing its parent drawer", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onParentOpenChange = vi.fn();
    render(
      <Drawer open onOpenChange={onParentOpenChange}>
        <DrawerContent>
          <DrawerTitle>Notes</DrawerTitle>
          <DrawerDescription>All notes</DrawerDescription>
          <NoteDialog
            open
            note={savedNote}
            onOpenChange={onOpenChange}
            onSave={vi.fn()}
          />
        </DrawerContent>
      </Drawer>,
    );
    typeInNote(await findNoteEditor(), " changed");
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onParentOpenChange).not.toHaveBeenCalled();
  });
});
