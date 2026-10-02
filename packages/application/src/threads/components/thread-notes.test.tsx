import type { ThreadNote, ThreadNoteId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  onToggleDone: vi.fn(),
  onRemove: vi.fn(),
});

describe("ThreadNotes", () => {
  it("keeps the space below capture empty while Notes initially load", () => {
    render(
      <ThreadNotes
        notes={undefined}
        doneNotes={[]}
        isDoneExhausted={false}
        isDoneInitialLoading
        {...actions()}
      />,
    );
    expect(screen.queryByText("Loading Notes…")).toBeNull();
    expect(screen.queryByRole("button", { name: /completed/i })).toBeNull();
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
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Called the clinic{Enter}Waiting for a reply",
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
    expect(
      within(dialog).getByRole("link", { name: "Portal" }),
    ).toHaveAttribute("href", "https://example.com");
    await user.click(within(dialog).getByRole("tab", { name: "Write" }));
    await user.clear(screen.getByRole("textbox", { name: "Note body" }));
    await user.type(
      screen.getByRole("textbox", { name: "Note body" }),
      "Clinic called back",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(callbacks.onUpdateBody).toHaveBeenCalledWith(
      saved,
      "Clinic called back",
    );
    expect(within(dialog).getByText("Clinic called back")).toBeVisible();
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
  it("completes a card without opening the view", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    const saved = note("Called the clinic");
    render(<ThreadNotes notes={[saved]} {...callbacks} />);
    await user.click(screen.getByRole("button", { name: "Mark note done" }));
    expect(callbacks.onToggleDone).toHaveBeenCalledWith(saved);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps a Note view open when completion removes its card from Open Notes", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    const saved = note("Consultation");
    const { rerender } = render(<ThreadNotes notes={[saved]} {...callbacks} />);
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    await user.click(screen.getByRole("button", { name: "Mark done" }));
    rerender(
      <ThreadNotes
        notes={[]}
        doneNotes={[{ ...saved, state: "done", completedAt: 2000 }]}
        {...callbacks}
      />,
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeVisible();
  });
  it("keeps Done Notes in collapsed history and can reopen them", async () => {
    const user = userEvent.setup();
    const callbacks = actions();
    const done = note("Finished note", { state: "done", completedAt: 2000 });
    render(<ThreadNotes notes={[]} doneNotes={[done]} {...callbacks} />);
    expect(
      screen.queryByRole("button", { name: /Open note: Finished note/ }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: /completed/i }));
    await user.click(screen.getByRole("button", { name: "Mark note open" }));
    expect(callbacks.onToggleDone).toHaveBeenCalledWith(done);
  });
});
