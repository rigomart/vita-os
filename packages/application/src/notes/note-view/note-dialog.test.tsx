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

describe("NoteDialog", () => {
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
  it("captures a multiline body with no title or classification", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<NoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "A thought{Enter}Its context",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      body: "A thought\nIts context",
      when: undefined,
    });
  });
});

const savedNote = {
  body: "Consultation notes",
  state: "open" as const,
  createdAt: new Date("2026-09-30T12:00:00").getTime(),
};

describe("NoteDialog read and edit", () => {
  it("opens saved notes as a document with Thread context and dates", () => {
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
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Attention date" })).toBeNull();
  });

  it("saves an edited body with Ctrl+Enter and displays it while the parent catches up", async () => {
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
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", { name: "Note body" });
    await user.clear(textarea);
    await user.type(textarea, "Updated consultation");
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Updated consultation");
    expect(screen.getByText("Updated consultation")).toBeInTheDocument();
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

  it("returns to read mode on Escape from an unchanged edit", async () => {
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
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each(["Cancel", "Escape"])(
    "confirms dirty edit %s and returns to read mode on discard",
    async (action) => {
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
      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.type(
        screen.getByRole("textbox", { name: "Note body" }),
        " changed",
      );
      if (action === "Cancel")
        await user.click(screen.getByRole("button", { name: "Cancel" }));
      else await user.keyboard("{Escape}");
      expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
        "Discard changes?",
      );
      await user.click(screen.getByRole("button", { name: "Discard" }));
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.getByText("Consultation notes")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    },
  );

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
    await user.click(screen.getByRole("button", { name: "Edit" }));
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

  it("requires confirmation to delete and guards the asynchronous action", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onDelete = vi.fn(() => pending.promise);
    const onOpenChange = vi.fn();
    const { feedback } = render(
      <NoteDialog
        open
        onOpenChange={onOpenChange}
        note={savedNote}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete note" }));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Delete note?",
    );
    const confirm = screen.getByRole("button", { name: "Delete" });
    await user.click(confirm);
    await user.click(confirm);
    expect(onDelete).toHaveBeenCalledTimes(1);
    pending.resolve();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(feedback.success).toHaveBeenCalledWith("Note deleted");
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
    const done = screen.getByRole("button", { name: "Done" });
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
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", { name: "Note body" });
    await user.clear(textarea);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("NoteDialog compose dismissal", () => {
  it("closes an empty compose draft without asking", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps a dirty compose draft until discard is confirmed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Unsaved thought",
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Discard changes?",
    );
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
      "Unsaved thought",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
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
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Discard changes?",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("confirms compose dismissal when only the Attention Date has changed", async () => {
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
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Discard changes?",
    );
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

describe("NoteDialog mobile Escape", () => {
  const originalWidth = window.innerWidth;
  beforeEach(() => {
    window.innerWidth = 390;
  });
  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it("returns an unchanged mobile edit to read without closing the drawer", async () => {
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
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("discards a changed mobile edit back to read without closing the drawer", async () => {
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
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      " changed",
    );
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Discard changes?",
    );
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cancels a mobile discard confirmation with Escape and keeps the edited draft", async () => {
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
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      " changed",
    );
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Discard changes?",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
      "Consultation notes changed",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps a dirty mobile drawer in place after a downward header swipe", async () => {
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
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Discard changes?",
    );
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Note body" })).toHaveValue(
      "Unsaved thought",
    );
    expect(drawer.style.transform).toBe(initialTransform);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("blocks mobile swipe attempts while a note is being added", async () => {
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

  it("still asks before closing a dirty mobile draft from outside", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<NoteDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Unsaved thought",
    );
    await user.click(document.querySelector('[data-slot="drawer-overlay"]')!);
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Discard changes?",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps a mobile deletion confirmation clickable and waits for success to close", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onDelete = vi.fn(() => pending.promise);
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        note={savedNote}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete note" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    pending.resolve();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("cancels mobile deletion with Escape while retaining the read drawer", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <NoteDialog
        open
        note={savedNote}
        onOpenChange={onOpenChange}
        onDelete={onDelete}
        onSave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete note" }));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      "Delete note?",
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("discards a nested mobile edit to read without closing its parent drawer", async () => {
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
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      " changed",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onParentOpenChange).not.toHaveBeenCalled();
  });
});
