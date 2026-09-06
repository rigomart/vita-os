import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

import { NewNoteDialog } from "./new-note-dialog";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("NewNoteDialog", () => {
  it("prevents duplicate note creates while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);
    const onOpenChange = vi.fn();

    render(
      <NewNoteDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />,
    );

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
      <NewNoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
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
      <NewNoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
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
    render(<NewNoteDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
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
