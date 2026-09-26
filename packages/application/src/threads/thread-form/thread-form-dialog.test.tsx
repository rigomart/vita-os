import type { AreaId, AreaSummary } from "@vita-os/contracts";
import type { ComponentProps } from "react";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createQuietApplicationClient,
  success,
} from "../../test/fake-application-client";
import { render, screen, waitFor } from "../../test/render-with-providers";
import { ThreadFormDialog } from "./thread-form-dialog";

const health = {
  _id: "area1" as AreaId,
  name: "Health",
  slug: "health",
  icon: "HeartPulse",
  order: 0,
  createdAt: 0,
} satisfies AreaSummary;

const home = {
  _id: "area2" as AreaId,
  name: "Home",
  slug: "home",
  icon: "Home",
  order: 1,
  createdAt: 0,
} satisfies AreaSummary;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

type DialogProps = ComponentProps<typeof ThreadFormDialog>;

function renderDialog(
  overrides: Partial<DialogProps> = {},
  client = createQuietApplicationClient({
    listAreas: async () => success([health, home]),
  }),
) {
  const onSubmit = vi.fn<DialogProps["onSubmit"]>(async () => undefined);
  const props: DialogProps = {
    mode: "create",
    open: true,
    onOpenChange: vi.fn(),
    onSubmit,
    ...overrides,
  };
  return {
    ...render(<ThreadFormDialog {...props} />, { applicationClient: client }),
    onSubmit: props.onSubmit,
  };
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^(Area:|Add area)/ }));
  return screen.findByPlaceholderText("Find or create an area…");
}

describe("ThreadFormDialog", () => {
  it("uses Thread language on create", () => {
    renderDialog();

    expect(
      screen.getByRole("heading", { name: "New thread" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeInTheDocument();
  });

  it("creates a Thread with only a title", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText("Title"), "Renew passport");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(onSubmit).toHaveBeenCalledWith({ title: "Renew passport" });
  });

  it("starts on the filtered Area, which can be cleared before saving", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ defaultAreaId: health._id });

    expect(
      await screen.findByRole("button", { name: "Area: Health" }),
    ).toBeInTheDocument();

    await openPicker(user);
    await user.click(
      await screen.findByRole("option", { name: "Remove area" }),
    );
    await user.type(screen.getByLabelText("Title"), "Renew passport");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(onSubmit).toHaveBeenCalledWith({ title: "Renew passport" });
  });

  it("labels the Thread with an Area picked from the list", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await openPicker(user);
    await user.click(await screen.findByRole("option", { name: "Home" }));
    await user.type(screen.getByLabelText("Title"), "Fix the gate");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Fix the gate",
      areaId: home._id,
    });
  });

  it("creates an Area by typing a new name, and labels the Thread with it", async () => {
    const user = userEvent.setup();
    const career = { ...home, _id: "area3" as AreaId, name: "Career" };
    const stored: AreaSummary[] = [health, home];
    const createArea = vi.fn(async () => {
      stored.push(career);
      return success(career);
    });
    const client = createQuietApplicationClient({
      listAreas: async () => success([...stored]),
      createArea,
    });
    const { onSubmit } = renderDialog({}, client);

    const search = await openPicker(user);
    await user.type(search, "Career");
    await user.click(
      await screen.findByRole("option", { name: "Create “Career”" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Area: Career" }),
      ).toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText("Title"), "Update résumé");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(createArea).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Career" }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Update résumé",
      areaId: career._id,
    });
  });

  it("offers the existing Area instead of a duplicate when its name is typed", async () => {
    const user = userEvent.setup();
    const createArea = vi.fn();
    renderDialog(
      {},
      createQuietApplicationClient({
        listAreas: async () => success([health, home]),
        createArea,
      }),
    );

    const search = await openPicker(user);
    await user.type(search, "  health ");

    expect(
      await screen.findByRole("option", { name: "Health" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Create/ }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("button", { name: "Area: Health" }),
    ).toBeInTheDocument();
    expect(createArea).not.toHaveBeenCalled();
  });

  it("starts fresh when remounted for a new thread", async () => {
    const user = userEvent.setup();
    // AppShell mounts the create dialog only while it is open, so a reopen is
    // a remount rather than a prop flip.
    const { unmount } = renderDialog({ defaultAreaId: health._id });
    await user.type(screen.getByLabelText("Title"), "Draft title");
    unmount();
    renderDialog({ defaultAreaId: health._id });

    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(
      await screen.findByRole("button", { name: "Area: Health" }),
    ).toBeInTheDocument();
  });

  it("prevents duplicate thread creates while saving", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const { onSubmit } = renderDialog({
      onSubmit: vi.fn(() => pendingCreate.promise),
    });

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
    const { onSubmit } = renderDialog({
      onSubmit: vi.fn(() => pendingCreate.promise),
    });

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
    const { feedback } = renderDialog({
      onSubmit: vi.fn(() => Promise.reject(new Error("Database unavailable"))),
    });

    await user.type(screen.getByLabelText("Title"), "Renew passport");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thread was not saved. Database unavailable",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("shows a structural success toast when thread creation succeeds", async () => {
    const user = userEvent.setup();
    const { feedback } = renderDialog();

    await user.type(screen.getByLabelText("Title"), "Renew passport");
    await user.click(screen.getByRole("button", { name: "Create thread" }));

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Thread created"),
    );
  });

  it("prevents duplicate thread edits while saving without a success toast", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred();
    const { onSubmit, feedback } = renderDialog({
      mode: "edit",
      initialValue: { title: "Renew passport", areaId: health._id },
      onSubmit: vi.fn(() => pendingSave.promise),
    });

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
    const { feedback } = renderDialog({
      mode: "edit",
      initialValue: { title: "Renew passport", areaId: health._id },
      onSubmit: vi.fn(() => Promise.reject(new Error("Thread not found"))),
    });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Thread was not saved. Thread not found",
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
