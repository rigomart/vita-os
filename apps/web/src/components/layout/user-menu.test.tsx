import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/test/render-with-providers";

import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("changes appearance, reopens the account actions, and signs out", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    const onThemeChange = vi.fn();

    render(
      <UserMenu
        user={{ name: "Jane Doe", email: "jane@example.com" }}
        theme="system"
        onThemeChange={onThemeChange}
        onSignOut={onSignOut}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Jane Doe/ });
    await user.click(trigger);
    await user.click(
      await screen.findByRole("menuitem", { name: "Appearance" }),
    );
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Dark" }));

    expect(onThemeChange).toHaveBeenCalledWith("dark");

    await user.keyboard("{Escape}{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", { name: "Sign out" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("uses the email when the account has no name", () => {
    render(
      <UserMenu
        user={{ email: "jane@example.com" }}
        theme="system"
        onThemeChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /jane@example.com/ }),
    ).toBeVisible();
  });
});
