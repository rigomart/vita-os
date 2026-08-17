import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InboxSurface } from "./inbox-surface";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>,
  isMobile: false,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

// The screen itself is Convex-backed and covered by its own tests; what matters
// here is which shell it is mounted in and when that shell goes away.
vi.mock("@/features/inbox/screens/inbox-screen", () => ({
  InboxScreen: () => <p>inbox screen</p>,
}));

function panel() {
  return document.querySelector('[data-slot="inbox-surface-panel"]');
}

function renderSurface() {
  const view = render(<InboxSurface />);
  return {
    ...view,
    /** Re-reads the search param the way a router navigation would. */
    setOpen(isOpen: boolean) {
      mocks.search = isOpen ? { inbox: true } : {};
      view.rerender(<InboxSurface />);
    },
  };
}

describe("InboxSurface", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    mocks.search = { inbox: true };
    mocks.isMobile = false;
  });

  it("stays out of the way while the Inbox is not summoned", () => {
    mocks.search = {};
    renderSurface();

    expect(panel()).toBeNull();
    expect(screen.queryByText("inbox screen")).toBeNull();
  });

  it("hangs the panel off the top bar on a pointer-sized viewport", async () => {
    renderSurface();

    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "open"));
    expect(screen.getByRole("dialog", { name: "Inbox" })).toHaveFocus();
  });

  it("falls back to a bottom drawer on a phone", async () => {
    mocks.isMobile = true;
    renderSurface();

    expect(await screen.findByText("inbox screen")).toBeVisible();
    expect(panel()).toBeNull();
    expect(
      document.querySelector('[data-slot="drawer-content"]'),
    ).toBeVisible();
  });

  it("strips the param on a click outside, then leaves once it has faded", async () => {
    const view = renderSurface();
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "open"));

    fireEvent.pointerDown(document.body);

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    const [navigation] = mocks.navigate.mock.calls[0] as [
      { replace: boolean; search: (previous: object) => object },
    ];
    expect(navigation.replace).toBe(true);
    expect(navigation.search({ inbox: true, thread: "a" })).toEqual({
      inbox: undefined,
      thread: "a",
    });

    // The route is already closed; the panel is only seeing itself out.
    view.setOpen(false);
    const closing = panel();
    expect(closing).toHaveAttribute("data-state", "closed");
    expect(closing).toHaveAttribute("aria-hidden", "true");

    fireEvent.transitionEnd(closing as Element, { propertyName: "opacity" });

    expect(panel()).toBeNull();
  });

  it("turns back around when the Inbox is summoned again mid-exit", async () => {
    const view = renderSurface();
    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "open"));

    view.setOpen(false);
    expect(panel()).toHaveAttribute("data-state", "closed");

    view.setOpen(true);

    await waitFor(() => expect(panel()).toHaveAttribute("data-state", "open"));
    expect(screen.getByText("inbox screen")).toBeVisible();
  });
});
