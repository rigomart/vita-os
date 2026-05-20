import type { Doc, Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectLifecycleActions } from "./project-lifecycle-actions";

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: "project1" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Renew passport",
    slug: "renew-passport",
    areaId: "area1" as Id<"areas">,
    state: "open",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe("ProjectLifecycleActions", () => {
  it("resolves an open Thread with an optional note", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();

    render(
      <ProjectLifecycleActions
        project={makeProject()}
        onResolve={onResolve}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Drop" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Resolve" }));
    await user.type(
      screen.getByLabelText("Resolution note"),
      "Passport arrived",
    );
    await user.click(screen.getByRole("button", { name: "Resolve thread" }));

    expect(onResolve).toHaveBeenCalledWith("Passport arrived");
  });

  it("reopens a resolved Thread", async () => {
    const user = userEvent.setup();
    const onReopen = vi.fn();

    render(
      <ProjectLifecycleActions
        project={makeProject({ state: "resolved" })}
        onResolve={vi.fn()}
        onReopen={onReopen}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reopen" }));

    expect(onReopen).toHaveBeenCalled();
  });

  it("treats legacy completed Threads as resolved", async () => {
    const user = userEvent.setup();
    const onReopen = vi.fn();

    render(
      <ProjectLifecycleActions
        project={makeProject({ state: "completed" })}
        onResolve={vi.fn()}
        onReopen={onReopen}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reopen" }));

    expect(onReopen).toHaveBeenCalled();
  });
});
