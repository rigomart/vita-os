import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThreadDefinition } from "./thread-definition";

const longSummary = Array.from(
  { length: 12 },
  (_, index) => `Line ${index + 1}`,
).join("\n");

describe("ThreadDefinition", () => {
  it("reveals a compact Summary editor from a plain text action", async () => {
    const user = userEvent.setup();

    render(<ThreadDefinition summary="" onSave={vi.fn()} />);

    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    const addSummary = screen.getByRole("button", { name: "Add a summary…" });
    // Text, not a chip: nothing is filled in yet, so nothing is framed.
    expect(addSummary).toHaveClass("w-fit");
    expect(addSummary).not.toHaveClass("bg-secondary");
    expect(addSummary.closest('[data-slot="thread-summary"]')).toHaveClass(
      "min-h-7",
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

  it("reads a Summary left-aligned within a readable measure", () => {
    render(<ThreadDefinition summary="Brief context" onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Brief context" })).toHaveClass(
      "text-left",
      "max-w-[65ch]",
    );
  });

  it("holds every Summary to a single truncated line", () => {
    const { rerender } = render(
      <ThreadDefinition summary={longSummary} onSave={vi.fn()} />,
    );

    // `block` so the ellipsis applies: the display is otherwise a flex button.
    expect(screen.getByRole("button", { name: /Line 1/ })).toHaveClass(
      "block",
      "truncate",
    );
    // Nothing expands in place — the full text is read in the editor.
    expect(
      screen.queryByRole("button", { name: "Show more" }),
    ).not.toBeInTheDocument();

    rerender(<ThreadDefinition summary="Brief context" onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Brief context" })).toHaveClass(
      "truncate",
    );
  });

  it("opens the whole Summary in the editor from its one line", async () => {
    const user = userEvent.setup();

    render(<ThreadDefinition summary={longSummary} onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Line 1/ }));

    expect(screen.getByRole("textbox", { name: "Thread summary" })).toHaveValue(
      longSummary,
    );
  });
});
