import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "../test/render-with-providers";
import { ActionBar } from "./action-bar";
import { skyAt } from "./sky";
import { SkyHeader } from "./sky-header";

vi.mock("../viewer/viewer-context", () => ({
  useViewer: () => ({
    viewer: { name: "Sam", email: "sam@example.com" },
    signOut: vi.fn(),
  }),
}));

vi.mock("../theme/theme-provider", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: vi.fn(),
    resolvedTheme: "light",
  }),
}));

function actions() {
  return { onNewNote: vi.fn(), onNewThread: vi.fn(), onOpenPalette: vi.fn() };
}

describe("SkyHeader", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // A Friday evening, at dusk.
    vi.setSystemTime(new Date(2026, 9, 9, 19, 30));
  });
  afterEach(() => vi.useRealTimers());

  it("names the day and paints the sky of this hour, with no items on it", () => {
    render(<SkyHeader {...actions()} />);

    const header = screen.getByRole("banner", { name: "Vita OS" });
    expect(header).toHaveTextContent("FridayOctober 9");
    const sky = skyAt(19.5);
    expect(header.style.background).toContain(sky.top);
    expect(header.style.color).toBe("rgb(246, 247, 252)");
  });

  it("offers search, a new Note and a new Thread, and the account menu", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const props = actions();
    render(<SkyHeader {...props} />);
    const header = within(screen.getByRole("banner"));

    await user.click(header.getByRole("button", { name: /^Search, / }));
    await user.click(header.getByRole("button", { name: "New note" }));
    await user.click(header.getByRole("button", { name: "New thread" }));

    expect(props.onOpenPalette).toHaveBeenCalledOnce();
    expect(props.onNewNote).toHaveBeenCalledOnce();
    expect(props.onNewThread).toHaveBeenCalledOnce();
    expect(header.getByRole("button", { name: "Sam" })).toBeVisible();
    expect(header.getByRole("link", { name: "Vita OS home" })).toBeVisible();
  });
});

describe("ActionBar", () => {
  it("offers search, a new Thread and a new Note within a thumb's reach", async () => {
    const user = userEvent.setup();
    const props = actions();
    render(<ActionBar {...props} />);
    const bar = within(screen.getByRole("navigation", { name: "Actions" }));

    await user.click(bar.getByRole("button", { name: /^Search, / }));
    await user.click(bar.getByRole("button", { name: "New thread" }));
    await user.click(bar.getByRole("button", { name: "New note" }));

    expect(props.onOpenPalette).toHaveBeenCalledOnce();
    expect(props.onNewThread).toHaveBeenCalledOnce();
    expect(props.onNewNote).toHaveBeenCalledOnce();
  });
});
