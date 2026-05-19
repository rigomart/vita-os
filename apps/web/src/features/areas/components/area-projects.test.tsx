import type { Doc, Id } from "@convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AreaProjects } from "./area-projects";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const project = {
  _id: "project1" as Id<"projects">,
  _creationTime: 0,
  userId: "user1",
  name: "Renew passport",
  slug: "renew-passport",
  areaId: "area1" as Id<"areas">,
  state: "active",
  order: 0,
  createdAt: 0,
} satisfies Doc<"projects">;

describe("AreaProjects", () => {
  it("lists threads under the area with Thread language", () => {
    render(
      <AreaProjects
        areaSlug="admin"
        projects={[project]}
        onCreateProject={vi.fn()}
        onRemoveProject={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Threads" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New thread" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Renew passport")).toBeInTheDocument();
    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
  });

  it("shows an empty state that invites creating a thread", () => {
    render(
      <AreaProjects
        areaSlug="admin"
        projects={[]}
        onCreateProject={vi.fn()}
        onRemoveProject={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No threads in this area yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create thread" }),
    ).toBeInTheDocument();
  });
});
