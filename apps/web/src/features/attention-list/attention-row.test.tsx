import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import type { AttentionRowModel } from "./attention-row-model";

import { AttentionRow } from "./attention-row";

const now = Date.now();

const baseRow: AttentionRowModel = {
  title: "Buy milk",
  onToggleDone: vi.fn(),
  onUpdateText: vi.fn(),
  onSetWhen: vi.fn(),
};

describe("AttentionRow", () => {
  it("disables the complete checkbox while a toggle is pending", async () => {
    const user = userEvent.setup();
    const onToggleDone = vi.fn();

    render(
      <AttentionRow
        now={now}
        row={{
          ...baseRow,
          onToggleDone,
          toggleBusy: true,
        }}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Mark task done" });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toHaveAttribute("aria-busy", "true");

    await user.click(checkbox);
    expect(onToggleDone).not.toHaveBeenCalled();
  });

  it("saves edited text once when pressing Enter then blurring", async () => {
    const user = userEvent.setup();
    const onUpdateText = vi.fn();

    render(
      <AttentionRow
        now={now}
        row={{
          ...baseRow,
          onUpdateText,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: baseRow.title }));
    const input = screen.getByRole("textbox", { name: "Edit task text" });
    fireEvent.change(input, { target: { value: "Buy oat milk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(onUpdateText).toHaveBeenCalledTimes(1);
    expect(onUpdateText).toHaveBeenCalledWith("Buy oat milk");
  });
});
