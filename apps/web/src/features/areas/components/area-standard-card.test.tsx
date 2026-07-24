import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { AreaStandardCard } from "./area-standard-card";

describe("AreaStandardCard", () => {
  it("starts with a text button and opens a one-row editor", async () => {
    const user = userEvent.setup();
    render(<AreaStandardCard standard="" onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add a Standard…" }));

    const editor = screen.getByRole("textbox", { name: "Area Standard" });
    expect(editor).toHaveAttribute("rows", "1");
    expect(editor).toHaveClass("max-h-[4.5rem]");
    expect(editor).not.toHaveClass("border-b");
  });
});
