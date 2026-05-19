import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectDefinition } from "./project-definition";

describe("ProjectDefinition", () => {
  it("presents optional Summary instead of Definition of Done", () => {
    render(<ProjectDefinition definitionOfDone="" onSave={vi.fn()} />);

    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.queryByText("Definition of Done")).not.toBeInTheDocument();
    expect(screen.getByText("What is this thread about?")).toBeInTheDocument();
  });
});
