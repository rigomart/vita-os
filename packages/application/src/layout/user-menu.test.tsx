import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createFeedbackMock,
  fireEvent,
  render,
  screen,
  waitFor,
} from "../test/render-with-providers";
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

  it("offers Download my data only when the host provides it", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <UserMenu
        user={{ name: "Jane Doe" }}
        theme="system"
        onThemeChange={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Jane Doe/ }));
    await screen.findByRole("menuitem", { name: "Sign out" });
    expect(
      screen.queryByRole("menuitem", { name: "Download my data" }),
    ).not.toBeInTheDocument();
    unmount();

    const downloadData = vi.fn(async () => {});
    const feedback = createFeedbackMock();
    render(
      <UserMenu
        user={{ name: "Jane Doe" }}
        theme="system"
        onThemeChange={vi.fn()}
        onSignOut={vi.fn()}
        onDownloadData={downloadData}
      />,
      { feedback },
    );
    await user.click(screen.getByRole("button", { name: /Jane Doe/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Download my data" }),
    );

    expect(downloadData).toHaveBeenCalledOnce();
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("says so when the download fails", async () => {
    const user = userEvent.setup();
    const feedback = createFeedbackMock();
    render(
      <UserMenu
        user={{ name: "Jane Doe" }}
        theme="system"
        onThemeChange={vi.fn()}
        onSignOut={vi.fn()}
        onDownloadData={() => Promise.reject(new Error("500"))}
      />,
      { feedback },
    );

    await user.click(screen.getByRole("button", { name: /Jane Doe/ }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Download my data" }),
    );

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith(
        "Your data was not downloaded. Please try again.",
      ),
    );
  });

  it("offers Import from a cloud export only when the host provides it, and says so when it can't start", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <UserMenu user={{}} theme="system" onThemeChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Account" }));
    await screen.findByRole("menuitem", { name: "Appearance" });
    expect(
      screen.queryByRole("menuitem", { name: "Import from a cloud export…" }),
    ).not.toBeInTheDocument();
    unmount();

    const feedback = createFeedbackMock();
    const importData = vi.fn(() => Promise.reject(new Error("refused")));
    render(
      <UserMenu
        user={{}}
        theme="system"
        onThemeChange={vi.fn()}
        onImportData={importData}
      />,
      { feedback },
    );
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Import from a cloud export…",
      }),
    );

    expect(importData).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith(
        "Your data was not imported. Please try again.",
      ),
    );
  });

  it("offers the theme choice and no Sign out when the host has no session to end", async () => {
    const user = userEvent.setup();
    render(<UserMenu user={{}} theme="system" onThemeChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Account" }));

    expect(
      await screen.findByRole("menuitem", { name: "Appearance" }),
    ).toBeVisible();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(
      screen.queryByRole("menuitem", { name: "Sign out" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
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
