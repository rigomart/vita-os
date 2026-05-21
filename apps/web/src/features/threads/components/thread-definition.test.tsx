import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThreadDefinition } from "./thread-definition";

describe("ThreadDefinition", () => {
  it("presents optional Summary copy", () => {
    render(<ThreadDefinition summary="" onSave={vi.fn()} />);

    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("What is this thread about?")).toBeInTheDocument();
  });
});
