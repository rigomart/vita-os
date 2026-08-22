import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThreadDefinition } from "./thread-definition";

const LINE_HEIGHT = 20;
const CLAMP_LINES = 6;

const lineCount = (element: HTMLElement) =>
  (element.textContent ?? "").split("\n").length;

/**
 * jsdom has no layout, so every height is 0. Stand in for one: a clamped
 * element is six lines tall, an unclamped one is as tall as its text.
 */
function stubTextLayout() {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return lineCount(this) * LINE_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      const lines = this.className.includes("line-clamp-6")
        ? Math.min(lineCount(this), CLAMP_LINES)
        : lineCount(this);
      return lines * LINE_HEIGHT;
    },
  });
}

const longSummary = Array.from(
  { length: 12 },
  (_, index) => `Line ${index + 1}`,
).join("\n");

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

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

  it("reads a Summary left-aligned within a readable measure", () => {
    render(<ThreadDefinition summary="Brief context" onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Brief context" })).toHaveClass(
      "text-left",
      "max-w-[65ch]",
    );
  });

  it("clamps a long Summary and leaves a short one alone", () => {
    stubTextLayout();

    const { rerender } = render(
      <ThreadDefinition summary={longSummary} onSave={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /Line 1/ })).toHaveClass(
      "line-clamp-6!",
      "whitespace-pre-wrap",
    );
    expect(screen.getByRole("button", { name: "Show more" })).toBeVisible();

    rerender(<ThreadDefinition summary="Brief context" onSave={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "Show more" }),
    ).not.toBeInTheDocument();
  });

  it("expands and re-collapses a long Summary without opening the editor", async () => {
    stubTextLayout();
    const user = userEvent.setup();

    render(<ThreadDefinition summary={longSummary} onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Show more" }));

    const expanded = screen.getByRole("button", { name: /Line 1/ });
    expect(expanded).not.toHaveClass("line-clamp-6!");
    expect(expanded).toHaveTextContent("Line 12");
    expect(
      screen.queryByRole("textbox", { name: "Thread summary" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show less" }));

    expect(screen.getByRole("button", { name: /Line 1/ })).toHaveClass(
      "line-clamp-6!",
    );
    expect(screen.getByRole("button", { name: "Show more" })).toBeVisible();
  });
});
