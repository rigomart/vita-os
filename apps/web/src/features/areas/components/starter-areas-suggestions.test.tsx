import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StarterAreasSuggestions } from "./starter-areas-suggestions";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("StarterAreasSuggestions", () => {
  it("prevents duplicate starter Area creates while a selection is pending", async () => {
    const user = userEvent.setup();
    const pendingCreate = deferred();
    const onSelect = vi.fn(() => pendingCreate.promise);

    render(<StarterAreasSuggestions onSelect={onSelect} />);

    const familyHealth = screen.getByRole("button", {
      name: "Family Health",
    });

    await user.click(familyHealth);
    await user.click(familyHealth);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(familyHealth).toBeDisabled();
    expect(familyHealth).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Career" })).toBeDisabled();

    pendingCreate.resolve();

    await waitFor(() => expect(familyHealth).toBeEnabled());
  });
});
