import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFeedbackMock,
  type FeedbackMock,
  renderWithProviders,
} from "@/test/render-with-providers";

import { AreaFormDialog } from "./area-form-dialog";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

describe("AreaFormDialog", () => {
  let feedback: FeedbackMock;

  beforeEach(() => {
    feedback = createFeedbackMock();
  });

  function renderWithFeedback(ui: Parameters<typeof renderWithProviders>[0]) {
    return renderWithProviders(ui, { feedback });
  }

  it("prevents duplicate area creates while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);
    const onOpenChange = vi.fn();

    renderWithFeedback(
      <AreaFormDialog
        mode="create"
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Health");

    const createButton = screen.getByRole("button", { name: "Create area" });
    await user.click(createButton);
    await user.click(createButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(createButton).toBeDisabled();
    expect(createButton).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();

    pendingCreate.resolve();

    await waitFor(() =>
      expect(createButton).toHaveAttribute("aria-busy", "false"),
    );
  });

  it("prevents duplicate area creates from repeated Enter submits while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);

    renderWithFeedback(
      <AreaFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Health");
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Create area" })).toBeDisabled();

    pendingCreate.resolve();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create area" }),
      ).toHaveAttribute("aria-busy", "false"),
    );
  });

  it("shows a clear inline error when area creation fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() =>
      Promise.reject(new Error("Database unavailable")),
    );

    renderWithFeedback(
      <AreaFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Health");
    await user.click(screen.getByRole("button", { name: "Create area" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Area was not saved. Database unavailable",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("shows a structural success toast when area creation succeeds", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    renderWithFeedback(
      <AreaFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Health");
    await user.click(screen.getByRole("button", { name: "Create area" }));

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Area created"),
    );
  });

  it("prevents duplicate area edits while saving without a success toast", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred();
    const onSubmit = vi.fn(() => pendingSave.promise);

    renderWithFeedback(
      <AreaFormDialog
        mode="edit"
        open
        onOpenChange={vi.fn()}
        initialValue={{ name: "Health", condition: "healthy" }}
        onSubmit={onSubmit}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    await user.click(saveButton);
    await user.click(saveButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(saveButton).toBeDisabled();
    expect(feedback.success).not.toHaveBeenCalled();

    pendingSave.resolve();

    await waitFor(() =>
      expect(saveButton).toHaveAttribute("aria-busy", "false"),
    );
  });

  it("shows a clear inline error when area editing fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.reject(new Error("Area not found")));

    renderWithFeedback(
      <AreaFormDialog
        mode="edit"
        open
        onOpenChange={vi.fn()}
        initialValue={{ name: "Health", condition: "healthy" }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Area was not saved. Area not found",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
