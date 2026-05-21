import type { Doc, Id } from "@convex/_generated/dataModel";

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

describe("ThreadFormDialog", () => {
  it("uses Thread language and optional Summary on create", () => {
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
    expect(screen.getByLabelText(/Summary/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeInTheDocument();
  });
});
