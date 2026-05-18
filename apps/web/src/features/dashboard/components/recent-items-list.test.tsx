import type { Doc, Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecentItemsList } from "./recent-items-list";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function item(
  id: string,
  text: string,
  createdAt: number,
  isCompleted = false,
): Doc<"items"> {
  return {
    _id: id as Id<"items">,
    _creationTime: createdAt,
    userId: "user1",
    text,
    isCompleted,
    createdAt,
    completedAt: isCompleted ? createdAt + 1 : undefined,
  };
}

describe("RecentItemsList", () => {
  it("shows at most five recent uncompleted Items as a read-only list", () => {
    render(
      <RecentItemsList
        items={[
          item("item1", "First active item", 7),
          item("item2", "Completed item", 6, true),
          item("item3", "Second active item", 5),
          item("item4", "Third active item", 4),
          item("item5", "Fourth active item", 3),
          item("item6", "Fifth active item", 2),
          item("item7", "Sixth active item", 1),
        ]}
      />,
    );

    expect(screen.getByText("First active item")).toBeInTheDocument();
    expect(screen.getByText("Fifth active item")).toBeInTheDocument();
    expect(screen.queryByText("Completed item")).not.toBeInTheDocument();
    expect(screen.queryByText("Sixth active item")).not.toBeInTheDocument();

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /process item/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /discard item/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add date/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit item text/i)).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /view all items/i }),
    ).toHaveAttribute("href", "/inbox");
  });
});
