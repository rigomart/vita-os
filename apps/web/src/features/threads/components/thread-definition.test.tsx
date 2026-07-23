import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThreadDefinition } from "./thread-definition";

describe("ThreadDefinition", () => {
  it("presents optional Summary copy", () => {
    render(<ThreadDefinition summary="" onSave={vi.fn()} />);

    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("What is this thread about?")).toBeInTheDocument();
  });

  it("keeps a short Summary content-sized until editing", () => {
    render(<ThreadDefinition summary="Brief context" onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Brief context" })).toHaveClass(
      "min-h-0",
    );
  });
});
