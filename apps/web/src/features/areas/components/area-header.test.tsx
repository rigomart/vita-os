import type { Doc } from "@convex/_generated/dataModel";
import type { AreaIcon } from "@convex/lib/areaIcons";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

import { AreaHeader } from "./area-header";

const area = {
  _id: "area1",
  _creationTime: 1,
  userId: "user1",
  name: "Health",
  icon: "Compass",
  condition: "healthy",
  order: 0,
  createdAt: 1,
} as Doc<"areas">;

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderHeader(onIconChange: (icon: AreaIcon) => Promise<void> | void) {
  return render(
    <AreaHeader
      area={area}
      threadCount={0}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onConditionChange={vi.fn()}
      onIconChange={onIconChange}
    />,
  );
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
