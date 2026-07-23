import userEvent from "@testing-library/user-event";
import { SidebarProvider } from "@vita-os/ui/components/sidebar";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { SidebarUserMenu } from "./sidebar-user-menu";

describe("SidebarUserMenu", () => {
  it("opens the account actions and signs out", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    render(
      <SidebarProvider>
        <SidebarUserMenu
          user={{ name: "Jane Doe", email: "jane@example.com" }}
          onSignOut={onSignOut}
        />
      </SidebarProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Jane Doe/ }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("uses the email when the account has no name", () => {
    render(
      <SidebarProvider>
        <SidebarUserMenu
          user={{ email: "jane@example.com" }}
          onSignOut={vi.fn()}
        />
      </SidebarProvider>,
    );

    expect(
      screen.getByRole("button", { name: /jane@example.com/ }),
    ).toBeVisible();
  });
});
