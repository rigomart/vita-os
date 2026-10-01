import userEvent from "@testing-library/user-event";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@vita-os/ui/components/drawer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    const textarea = screen.getByPlaceholderText("What's on your mind?");
    await user.type(textarea, "Buy milk");

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

    await user.type(
      screen.getByPlaceholderText("What's on your mind?"),
      "Buy milk",
    );
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

    await user.type(
      screen.getByPlaceholderText("What's on your mind?"),
      "Buy milk",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note added"),
    );
  });

  it("starts in Write and captures a multiline body with no title or classification", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<NoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("tab", { name: "Write" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const textarea = screen.getByRole("textbox", { name: "Note body" });
    expect(textarea).toHaveFocus();
    await user.type(textarea, "A thought{Enter}Its context");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      body: "A thought\nIts context",
      when: undefined,
    });
  });

  it("previews a draft in Read and keeps it when switching back", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<NoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "## Clinic{Enter}- [[ ] Book bloods",
    );
    await user.click(screen.getByRole("tab", { name: "Read" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("heading", { name: "Clinic" })).toBeVisible();
    const task = screen.getByRole("checkbox", { name: "Book bloods" });
    expect(task).not.toBeChecked();
    await user.click(task);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", { name: "Write" }));
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
      "## Clinic\n- [x] Book bloods",
    );
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveFocus();
  });

  it("says there is nothing to read in an empty draft", async () => {
    const user = userEvent.setup();
    render(<NoteDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Read" }));
    expect(
      screen.getByText("Nothing to read yet. Switch to Write to start."),
    ).toBeVisible();
  });
});

const savedNote = {
  body: "Consultation notes",
  state: "open" as const,
  createdAt: new Date("2026-09-30T12:00:00").getTime(),
};

describe("NoteDialog saved note", () => {
  it("opens in Read with Thread context and dates", () => {
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
    expect(screen.getByText("Consultation notes")).toBeInTheDocument();
    expect(screen.getByText("Added Sep 30")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Read and manage this note.",
    );
    expect(screen.getByRole("tab", { name: "Read" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Attention date" })).toBeNull();
  });

  it("marks a Done note in the header", () => {
    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{
          ...savedNote,
          state: "done",
          completedAt: new Date("2026-10-01T12:00:00").getTime(),
        }}
        onToggleDone={vi.fn()}
      />,
    );
    expect(screen.getByText("Done Oct 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeVisible();
  });

  it("saves an edited body with Ctrl+Enter, returns to Read and displays it while the parent catches up", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    const { feedback, rerender } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Write" }));
    const textarea = screen.getByRole("textbox", { name: "Note body" });
    await user.clear(textarea);
    await user.type(textarea, "Updated consultation");
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Updated consultation");
    expect(screen.getByText("Updated consultation")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Write" })).toHaveFocus();
    expect(feedback.success).toHaveBeenCalledWith("Note saved");
    rerender(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{ ...savedNote, body: "Updated consultation" }}
        onSave={onSave}
      />,
    );
    expect(screen.getByText("Updated consultation")).toBeInTheDocument();
  });

  it("keeps unsaved edits in Read and saves them from there", async () => {
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
    await user.click(screen.getByRole("tab", { name: "Write" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      " changed",
    );
    await user.click(screen.getByRole("tab", { name: /Read/ }));
    expect(screen.getByText("Consultation notes changed")).toBeVisible();
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    expect(
      screen.getByRole("tab", { name: /^Write.*unsaved changes$/ }),
    ).toBeVisible();
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
    await user.click(screen.getByRole("tab", { name: "Write" }));
    const textarea = screen.getByRole("textbox", { name: "Note body" });
    await user.type(textarea, " changed");
    const save = screen.getByRole("button", { name: "Save" });
    await user.click(save);
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    pending.reject(new Error("Could not update note"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update note",
    );
    expect(textarea).toHaveValue("Consultation notes changed");
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("prevents saving an empty edited body", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onSave={onSave}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Write" }));
    const textarea = screen.getByRole("textbox", { name: "Note body" });
    await user.clear(textarea);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a ticked task straight from Read without a toast", async () => {
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
    await user.click(screen.getByRole("checkbox", { name: "Bloods" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      "Before the visit:\n\n- [x] Bloods",
    );
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Bloods" })).toBeChecked(),
    );
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
    await user.click(screen.getByRole("checkbox", { name: "Bloods" }));
    await waitFor(() => expect(feedback.error).toHaveBeenCalledOnce());
    expect(screen.getByRole("checkbox", { name: "Bloods" })).not.toBeChecked();
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

  it("guards completion and reports success only after the callback succeeds", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onToggleDone = vi.fn(() => pending.promise);
    const { feedback } = render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={savedNote}
        onToggleDone={onToggleDone}
      />,
    );
    const done = screen.getByRole("button", { name: "Mark done" });
    await user.click(done);
    await user.click(done);
    expect(onToggleDone).toHaveBeenCalledTimes(1);
    expect(done).toBeDisabled();
    expect(feedback.success).not.toHaveBeenCalled();
    pending.resolve();
    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note completed"),
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

  it("closes an unchanged saved note on Escape, even in Write", async () => {
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
    await user.click(screen.getByRole("tab", { name: "Write" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks inside the footer before dropping a dirty draft", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Unsaved thought",
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    const question = screen.getByRole("alertdialog", { name: discardQuestion });
    expect(screen.getByRole("dialog")).toContainElement(question);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
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
    await user.click(screen.getByRole("tab", { name: "Write" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      " changed",
    );
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
      "Consultation notes changed",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("guards clicking outside an unsaved compose draft", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Unsaved thought",
    );
    await user.click(document.querySelector('[data-slot="dialog-overlay"]')!);
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("asks before closing when only the Attention Date has changed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Attention date" }));
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

  it("omits Attention Date for Thread compose and closes after adding", async () => {
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
    expect(screen.queryByRole("button", { name: "Attention date" })).toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "New consultation",
    );
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
    await user.click(screen.getByRole("tab", { name: "Write" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      " changed",
    );
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("alertdialog", { name: discardQuestion }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
      "Consultation notes changed",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps a dirty drawer in place after a downward header swipe", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Unsaved thought",
    );
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
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
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
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "New thought",
    );
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
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Unsaved thought",
    );
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
    await user.click(screen.getByRole("tab", { name: "Write" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      " changed",
    );
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onParentOpenChange).not.toHaveBeenCalled();
  });
});
