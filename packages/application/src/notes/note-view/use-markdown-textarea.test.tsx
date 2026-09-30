import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useMarkdownTextarea } from "./use-markdown-textarea";

function Editor({ initialValue }: { initialValue: string }) {
  const [value, onChange] = useState(initialValue);
  const helpers = useMarkdownTextarea({ value, onChange });
  return (
    <textarea
      aria-label="Note body"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...helpers}
    />
  );
}

function editor(value: string, start = value.length, end = start) {
  render(<Editor initialValue={value} />);
  const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
  textarea.focus();
  textarea.setSelectionRange(start, end);
  return textarea;
}

describe("useMarkdownTextarea", () => {
  it.each([
    ["- Tests", "- Tests\n- "],
    ["  * Tests", "  * Tests\n  * "],
    ["  9. Tests", "  9. Tests\n  10. "],
  ])("continues a list after %s", (before, after) => {
    const textarea = editor(before);
    expect(fireEvent.keyDown(textarea, { key: "Enter" })).toBe(false);
    expect(textarea.value).toBe(after);
    expect(textarea.selectionStart).toBe(after.length);
  });

  it("continues a list at the caret while preserving the remaining text", () => {
    const textarea = editor("- Blood test", 7);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("- Blood\n-  test");
    expect(textarea.selectionStart).toBe(10);
  });

  it("replaces a selected range when continuing a list", () => {
    const textarea = editor("- Blood test", 2, 7);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("- \n-  test");
    expect(textarea.selectionStart).toBe(5);
  });

  it("ends an empty nested list item without adding another marker", () => {
    const textarea = editor("- Tests\n  * ");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("- Tests\n");
    expect(textarea.selectionStart).toBe(8);
  });

  it("leaves normal Enter and submit shortcuts to their existing handlers", () => {
    const textarea = editor("Plain text");
    expect(fireEvent.keyDown(textarea, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true })).toBe(
      true,
    );
    expect(fireEvent.keyDown(textarea, { key: "Enter", metaKey: true })).toBe(
      true,
    );
    expect(textarea.value).toBe("Plain text");
  });

  it("indents and outdents list lines by two spaces while preserving the selection", () => {
    const textarea = editor("Heading\n- Tests", 10, 15);
    expect(fireEvent.keyDown(textarea, { key: "Tab" })).toBe(false);
    expect(textarea.value).toBe("Heading\n  - Tests");
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([12, 17]);
    expect(fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true })).toBe(
      false,
    );
    expect(textarea.value).toBe("Heading\n- Tests");
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([10, 15]);
  });

  it("allows Tab to move focus on ordinary text", () => {
    const textarea = editor("Plain text");
    expect(fireEvent.keyDown(textarea, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true })).toBe(
      true,
    );
    expect(textarea.value).toBe("Plain text");
  });

  it("allows ordinary Enter before a list marker", () => {
    const textarea = editor("- Tests", 0);
    expect(fireEvent.keyDown(textarea, { key: "Enter" })).toBe(true);
    expect(textarea.value).toBe("- Tests");
  });

  it("leaves an initial blank line alone when the caret is at the start", () => {
    const textarea = editor("\n- Tests", 0);
    expect(fireEvent.keyDown(textarea, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Enter" })).toBe(true);
    expect(textarea.value).toBe("\n- Tests");
  });

  it.each([
    [{ key: "b", metaKey: true }, "**Blood** test", 2, 7],
    [{ key: "i", ctrlKey: true }, "_Blood_ test", 1, 6],
  ])(
    "wraps the selection with formatting markers",
    (key, after, start, end) => {
      const textarea = editor("Blood test", 0, 5);
      fireEvent.keyDown(textarea, key);
      expect(textarea.value).toBe(after);
      expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([
        start,
        end,
      ]);
    },
  );

  it("places an empty selection between formatting markers", () => {
    const textarea = editor("Blood ");
    fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });
    expect(textarea.value).toBe("Blood ****");
    expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([8, 8]);
  });

  it("does not change content during IME composition", () => {
    const textarea = editor("- Tests");
    expect(
      fireEvent.keyDown(textarea, { key: "Enter", isComposing: true }),
    ).toBe(true);
    expect(textarea.value).toBe("- Tests");
  });
});
