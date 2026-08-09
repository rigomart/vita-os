import type { Doc, Id } from "@convex/_generated/dataModel";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("ThreadFormDialog", () => {
  it("uses Thread language on create", () => {
    render(
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
    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeInTheDocument();
  });

  it("starts fresh on the default Area when remounted for a new thread", async () => {
    const user = userEvent.setup();
    const props = {
      mode: "create",
      open: true,
      onOpenChange: vi.fn(),
      areas,
      defaultAreaId: areas[0]._id,
      onSubmit: vi.fn(),
    } as const;

    // AppShell mounts the create dialog only while it is open, so a reopen is
    // a remount rather than a prop flip.
    const { unmount } = render(<ThreadFormDialog {...props} />);
    await user.type(screen.getByLabelText("Title"), "Draft title");
    unmount();

    render(<ThreadFormDialog {...props} />);

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByRole("button", { name: /Health/ })).toBeInTheDocument();
  });

  it("prevents duplicate thread creates while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSubmit = vi.fn(() => pendingCreate.promise);

    render(
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

    render(
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

    const { feedback } = render(
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

    const { feedback } = render(
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

    const { feedback } = render(
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

    const { feedback } = render(
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
