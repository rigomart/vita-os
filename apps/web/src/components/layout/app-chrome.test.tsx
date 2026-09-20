import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { AppChrome } from "./app-chrome";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null }),
    signOut: vi.fn(),
  },
}));

vi.mock("@/features/theme/theme-provider", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: vi.fn(),
    resolvedTheme: "light",
  }),
}));

vi.mock("./area-status-strip", () => ({
  AreaStatusStrip: () => null,
}));

function renderChrome(
  overrides: Partial<Parameters<typeof AppChrome>[0]> = {},
) {
  const onOpenPalette = vi.fn();
  render(
    <AppChrome
      noteCount={0}
      inboxOpen={false}
      onToggleInbox={vi.fn()}
      onNewNote={vi.fn()}
      onNewThread={vi.fn()}
      onNewArea={vi.fn()}
      onOpenPalette={onOpenPalette}
      railOpen={false}
      {...overrides}
    />,
  );
  return { onOpenPalette };
}

describe("AppChrome palette trigger", () => {
  it("is an icon button on small screens, with the field waiting at sm", () => {
    renderChrome();

    const trigger = screen.getByRole("button", { name: /Jump anywhere/ });
    expect(trigger).toHaveClass("size-10");
    expect(trigger).not.toHaveClass("min-w-32");
    expect(trigger).toHaveClass("sm:min-w-48");

    expect(screen.getByText("Jump anywhere…")).toHaveClass(
      "hidden",
      "sm:inline",
    );
    expect(screen.getByText("Ctrl K")).toHaveClass("hidden", "sm:inline-flex");
  });

  it("opens the palette from the trigger", async () => {
    const user = userEvent.setup();
    const { onOpenPalette } = renderChrome();

    await user.click(screen.getByRole("button", { name: /Jump anywhere/ }));

    expect(onOpenPalette).toHaveBeenCalledOnce();
  });
});
