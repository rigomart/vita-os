import type { Id } from "@convex/_generated/dataModel";
import type { AreaIcon } from "@convex/lib/areaIcons";
import type { ProjectedArea } from "@convex/lib/validators";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

import { AreaHeader } from "./area-header";

const area = {
  _id: "area1" as Id<"areas">,
  name: "Health",
  slug: "health",
  icon: "Compass",
  condition: "healthy",
  order: 0,
  createdAt: 1,
} satisfies ProjectedArea;

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderHeader(
  onIconChange: (icon: AreaIcon) => Promise<void> | void,
  actions: { onEdit?: () => void; onDelete?: () => void } = {},
) {
  const onEdit = actions.onEdit ?? vi.fn();
  const onDelete = actions.onDelete ?? vi.fn();
  const result = render(
    <AreaHeader
      area={area}
      onEdit={onEdit}
      onDelete={onDelete}
      onConditionChange={vi.fn()}
      onIconChange={onIconChange}
    />,
  );

  return { ...result, onEdit, onDelete };
}

describe("AreaHeader icon picker", () => {
  it("closes immediately while saving the icon optimistically", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred();
    const onIconChange = vi.fn(() => pendingSave.promise);
    renderHeader(onIconChange);

    await user.click(screen.getByRole("button", { name: "Change Area icon" }));
    await user.click(screen.getByRole("button", { name: "Health" }));

    expect(onIconChange).toHaveBeenCalledTimes(1);
    expect(onIconChange).toHaveBeenCalledWith("HeartPulse");
    expect(
      screen.queryByRole("button", { name: "Health" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change Area icon" }),
    ).toBeDisabled();

    pendingSave.resolve();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Change Area icon" }),
      ).toBeEnabled(),
    );
  });

  it("keeps the picker closed and reports a failed optimistic save", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred();
    const onIconChange = vi.fn(() => pendingSave.promise);
    const { feedback } = renderHeader(onIconChange);

    await user.click(screen.getByRole("button", { name: "Change Area icon" }));
    await user.click(screen.getByRole("button", { name: "Health" }));
    pendingSave.reject(new Error("Database unavailable"));

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith("Database unavailable"),
    );
    expect(
      screen.queryByRole("button", { name: "Health" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change Area icon" }),
    ).toBeEnabled();
  });
});

describe("AreaHeader actions", () => {
  it("moves Edit into the Area actions menu", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderHeader(vi.fn(), { onEdit });

    await user.click(screen.getByRole("button", { name: "Area actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("confirms Delete from the Area actions menu", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderHeader(vi.fn(), { onDelete });

    await user.click(screen.getByRole("button", { name: "Area actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete area?")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Delete area" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
