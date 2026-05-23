import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NextMove } from "./next-move";

describe("NextMove", () => {
  it("displays the current next move text", () => {
    render(
      <NextMove
        nextMove="Call the clinic"
        onSet={vi.fn()}
        onClear={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("Call the clinic")).toBeDefined();
  });

  it("shows an empty state input when there is no next move", () => {
    render(
      <NextMove
        nextMove={undefined}
        onSet={vi.fn()}
        onClear={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("Add a next move...")).toBeDefined();
  });

  it("calls onSet when entering a new next move and pressing Enter", async () => {
    const user = userEvent.setup();
    const onSet = vi.fn();

    render(
      <NextMove
        nextMove={undefined}
        onSet={onSet}
        onClear={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Add a next move...");
    await user.type(input, "Call the clinic{Enter}");

    expect(onSet).toHaveBeenCalledWith("Call the clinic");
  });

  it("calls onComplete when the complete button is clicked", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(
      <NextMove
        nextMove="Call the clinic"
        onSet={vi.fn()}
        onClear={vi.fn()}
        onComplete={onComplete}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Complete next move" }),
    );

    expect(onComplete).toHaveBeenCalled();
  });

  it("calls onClear when the clear button is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <NextMove
        nextMove="Call the clinic"
        onSet={vi.fn()}
        onClear={onClear}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear next move" }));

    expect(onClear).toHaveBeenCalled();
  });

  it("keeps only pending next move actions disabled", () => {
    render(
      <NextMove
        nextMove="Call the clinic"
        onSet={vi.fn()}
        onClear={vi.fn()}
        onComplete={vi.fn()}
        pending={{ clear: true }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Clear next move" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Complete next move" }),
    ).not.toBeDisabled();
  });

  it("disables the add field while saving a next move", () => {
    render(
      <NextMove
        nextMove={undefined}
        onSet={vi.fn()}
        onClear={vi.fn()}
        onComplete={vi.fn()}
        pending={{ set: true }}
      />,
    );

    expect(screen.getByPlaceholderText("Add a next move...")).toBeDisabled();
  });

  it("enters edit mode on click and saves with Enter", async () => {
    const user = userEvent.setup();
    const onSet = vi.fn();

    render(
      <NextMove
        nextMove="Call the clinic"
        onSet={onSet}
        onClear={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Call the clinic"));
    const input = screen.getByDisplayValue("Call the clinic");
    await user.clear(input);
    await user.type(input, "Book appointment{Enter}");

    expect(onSet).toHaveBeenCalledWith("Book appointment");
  });
});
