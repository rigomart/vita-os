import type { Doc, Id } from "@convex/_generated/dataModel";

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFeedbackMock,
  type FeedbackMock,
  renderWithProviders,
} from "@/test/render-with-providers";

import { ThreadFormDialog } from "./thread-form-dialog";

const areas = [
  {
    _id: "area1" as Id<"areas">,
    _creationTime: 0,
    userId: "user1",
    name: "Health",
    slug: "health",
    condition: "healthy",
    order: 0,
    createdAt: 0,
  },
] satisfies Doc<"areas">[];

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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("ThreadFormDialog", () => {
  let feedback: FeedbackMock;

  beforeEach(() => {
    feedback = createFeedbackMock();
  });

  function renderWithFeedback(ui: Parameters<typeof renderWithProviders>[0]) {
    return renderWithProviders(ui, { feedback });
  }

  it("uses Thread language and optional Summary on create", () => {
    renderWithFeedback(
      <ThreadFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        areas={areas}
        defaultAreaId={areas[0]._id}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "New thread" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Summary/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeInTheDocument();
  });

  it("prevents duplicate thread creates while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);

    renderWithFeedback(
      <ThreadFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        areas={areas}
        defaultAreaId={areas[0]._id}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Renew passport");

    const createButton = screen.getByRole("button", { name: "Create thread" });
    await user.click(createButton);
    await user.click(createButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(createButton).toBeDisabled();
    expect(createButton).toHaveAttribute("aria-busy", "true");

    pendingCreate.resolve();

    await waitFor(() =>
      expect(createButton).toHaveAttribute("aria-busy", "false"),
    );
  });

  it("prevents duplicate thread creates from repeated Enter submits while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);

    renderWithFeedback(
      <ThreadFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        areas={areas}
        defaultAreaId={areas[0]._id}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Renew passport");
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeDisabled();

    pendingCreate.resolve();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create thread" }),
      ).toHaveAttribute("aria-busy", "false"),
    );
  });

  it("shows a clear inline error when thread creation fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() =>
      Promise.reject(new Error("Database unavailable")),
    );

    renderWithFeedback(
      <ThreadFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        areas={areas}
        defaultAreaId={areas[0]._id}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Renew passport");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thread was not saved. Database unavailable",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("shows a structural success toast when thread creation succeeds", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    renderWithFeedback(
      <ThreadFormDialog
        mode="create"
        open
        onOpenChange={vi.fn()}
        areas={areas}
        defaultAreaId={areas[0]._id}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Title"), "Renew passport");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Thread created"),
    );
  });

  it("prevents duplicate thread edits while saving without a success toast", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred();
    const onSubmit = vi.fn(() => pendingSave.promise);

    renderWithFeedback(
      <ThreadFormDialog
        mode="edit"
        open
        onOpenChange={vi.fn()}
        areas={areas}
        initialValue={{ title: "Renew passport", areaId: areas[0]._id }}
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

  it("shows a clear inline error when thread editing fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.reject(new Error("Thread not found")));

    renderWithFeedback(
      <ThreadFormDialog
        mode="edit"
        open
        onOpenChange={vi.fn()}
        areas={areas}
        initialValue={{ title: "Renew passport", areaId: areas[0]._id }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thread was not saved. Thread not found",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
