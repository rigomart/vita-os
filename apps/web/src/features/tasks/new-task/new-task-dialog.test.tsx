import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFeedbackMock,
  type FeedbackMock,
  renderWithProviders,
} from "@/test/render-with-providers";

import { NewTaskDialog } from "./new-task-dialog";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ??
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
});

describe("NewTaskDialog", () => {
  let feedback: FeedbackMock;

  beforeEach(() => {
    feedback = createFeedbackMock();
  });

  function renderWithFeedback(ui: Parameters<typeof renderWithProviders>[0]) {
    return renderWithProviders(ui, { feedback });
  }

  it("prevents duplicate task creates while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);
    const onOpenChange = vi.fn();

    renderWithFeedback(
      <NewTaskDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />,
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

  it("shows a clear inline error when task creation fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() =>
      Promise.reject(new Error("Could not save task")),
    );

    renderWithFeedback(
      <NewTaskDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.type(
      screen.getByPlaceholderText("What's on your mind?"),
      "Buy milk",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save task",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("shows a structural success toast when task creation succeeds", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    renderWithFeedback(
      <NewTaskDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.type(
      screen.getByPlaceholderText("What's on your mind?"),
      "Buy milk",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Task added"),
    );
  });
});
