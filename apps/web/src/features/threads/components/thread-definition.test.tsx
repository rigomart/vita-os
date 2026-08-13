import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThreadDefinition } from "./thread-definition";

describe("ThreadDefinition", () => {
  it("reveals a compact Summary editor from an optional text action", async () => {
    const user = userEvent.setup();

    render(<ThreadDefinition summary="" onSave={vi.fn()} />);

    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    const addSummary = screen.getByRole("button", { name: "Add a summary…" });
    expect(addSummary).toHaveClass("w-fit", "bg-secondary");
    expect(addSummary.closest('[data-slot="thread-summary"]')).toHaveClass(
      "min-h-9",
    );

    await user.click(addSummary);

    const editor = screen.getByRole("textbox", { name: "Thread summary" });
    expect(editor).toHaveAttribute("rows", "1");
    expect(editor).toHaveClass("field-sizing-content");
  });

  it("keeps a short Summary content-sized until editing", () => {
    render(<ThreadDefinition summary="Brief context" onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Brief context" })).toHaveClass(
      "min-h-0",
      "text-muted-foreground",
    );
  });

  it("shows a long definition in full instead of clamping it", () => {
    const definition = Array.from(
      { length: 12 },
      (_, index) => `Line ${index + 1}`,
    ).join("\n");

    render(<ThreadDefinition summary={definition} onSave={vi.fn()} />);

    const display = screen.getByRole("button", { name: /Line 1/ });
    expect(display).toHaveTextContent("Line 12");
    expect(display.className).not.toMatch(/max-h-/);
    expect(display.className).not.toMatch(/overflow-y-auto/);
    expect(display).toHaveClass("whitespace-pre-wrap");
  });
});
