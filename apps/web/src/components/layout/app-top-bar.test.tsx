import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { AppTopBar } from "./app-top-bar";

// The bar pulls in auth, theme and the Convex-backed Area strip; none of that
// is what these tests exercise, so each dependency is reduced to a stub.
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: undefined }),
    signOut: vi.fn(),
  },
}));

vi.mock("@/features/theme/theme-provider", () => ({
  useTheme: () => ({
    theme: "system",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("./top-bar-area-strip", () => ({
  TopBarAreaStrip: () => null,
}));

function renderTopBar() {
  return render(
    <AppTopBar
      taskCount={0}
      inboxActive={false}
      onNewTask={vi.fn()}
      onOpenPalette={vi.fn()}
    />,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("AppTopBar palette hint", () => {
  it("spells the shortcut with Ctrl on a non-Apple platform", () => {
    vi.stubGlobal("navigator", {
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });
    renderTopBar();

    expect(
      screen.getByRole("button", { name: /Jump anywhere/ }),
    ).toHaveTextContent("Ctrl K");
  });

  it("keeps the ⌘ glyph on an Apple platform", () => {
    vi.stubGlobal("navigator", {
      userAgentData: { platform: "macOS" },
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    renderTopBar();

    expect(
      screen.getByRole("button", { name: /Jump anywhere/ }),
    ).toHaveTextContent("⌘K");
  });

  it.each([
    ["Win32", "Jump anywhere, Control K"],
    ["MacIntel", "Jump anywhere, Command K"],
  ])("spells the shortcut out for screen readers on %s", (platform, label) => {
    vi.stubGlobal("navigator", { platform, userAgent: "" });
    renderTopBar();

    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
});
