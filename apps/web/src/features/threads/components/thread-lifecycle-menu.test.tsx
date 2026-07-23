import type { Doc, Id } from "@convex/_generated/dataModel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThreadLifecycleMenu } from "./thread-lifecycle-menu";

function makeThread(overrides: Partial<Doc<"threads">> = {}): Doc<"threads"> {
  return {
    _id: "thread1" as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title: "Renew passport",
    slug: "renew-passport",
    areaId: "area1" as Id<"areas">,
    state: "open",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe("ThreadLifecycleMenu", () => {
  it("resolves an open Thread with an optional continuity note", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();

    render(
      <ThreadLifecycleMenu
        thread={makeThread()}
        onResolve={onResolve}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Resolve" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Thread actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Resolve" }));
    await user.type(
      screen.getByLabelText("Resolution note"),
      "Passport arrived",
    );
    await user.click(screen.getByRole("button", { name: "Resolve thread" }));

    expect(onResolve).toHaveBeenCalledWith("Passport arrived");
  });

  it("asks for confirmation before deleting a Thread", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <ThreadLifecycleMenu
        thread={makeThread()}
        onResolve={vi.fn()}
        onReopen={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Thread actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Delete thread?" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Delete thread" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("reopens a resolved Thread from the lifecycle menu", async () => {
    const user = userEvent.setup();
    const onReopen = vi.fn();

    render(
      <ThreadLifecycleMenu
        thread={makeThread({ state: "resolved" })}
        onResolve={vi.fn()}
        onReopen={onReopen}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Thread actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reopen" }));

    expect(onReopen).toHaveBeenCalledOnce();
  });

  it("disables lifecycle actions while their mutations are pending", async () => {
    const user = userEvent.setup();

    render(
      <ThreadLifecycleMenu
        thread={makeThread({ state: "resolved" })}
        onResolve={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
        isReopening
        isDeleting
      />,
    );

    await user.click(screen.getByRole("button", { name: "Thread actions" }));

    expect(
      await screen.findByRole("menuitem", { name: "Reopen" }),
    ).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "data-disabled",
    );
  });
});
