import type { PropsWithChildren } from "react";

import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render-with-providers";

import type { QuickPanelArea } from "./area-quick-panel";

import { AreaQuickPanel } from "./area-quick-panel";

const mocks = vi.hoisted(() => ({
  mutation: vi.fn(),
  navigate: vi.fn(),
}));

// Base UI's popover measures and observes; jsdom provides neither.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (reference: unknown) => {
    const mutation = vi.fn((args: unknown) =>
      mocks.mutation(getFunctionName(reference as never), args),
    );
    return Object.assign(mutation, { withOptimisticUpdate: () => mutation });
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    Link: ({
      children,
      params = {},
      to,
      ...props
    }: PropsWithChildren<{ params?: Record<string, string>; to: string }>) => (
      <a
        href={Object.entries(params).reduce(
          (path, [key, value]) => path.replace(`$${key}`, value),
          to,
        )}
        {...props}
      >
        {children}
      </a>
    ),
  };
});

const area: QuickPanelArea = {
  condition: "needs_attention",
  id: "area1",
  name: "Family Health",
  slug: "family-health",
  standard: "Everyone seen once a year, nothing chased twice.",
};

function renderPanel(overrides: Partial<QuickPanelArea> = {}) {
  const onNewThread = vi.fn();
  const result = render(
    <AreaQuickPanel
      area={{ ...area, ...overrides }}
      onNewThread={onNewThread}
      trigger={
        <button type="button" aria-label="Area panel for Family Health" />
      }
    >
      <span>Family Health</span>
    </AreaQuickPanel>,
  );
  return { ...result, onNewThread };
}

const openTrigger = () =>
  screen.getByRole("button", { name: "Area panel for Family Health" });

describe("AreaQuickPanel", () => {
  beforeEach(() => {
    mocks.mutation.mockClear();
    mocks.navigate.mockClear();
  });

  it("stays closed until the trigger is used", () => {
    renderPanel();

    expect(openTrigger()).toBeVisible();
    expect(screen.queryByText("Standard")).toBeNull();
  });

  it("opens on click, showing the Condition, the Standard, and both ways on", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(openTrigger());

    expect(
      await screen.findByRole("radiogroup", {
        name: "Condition for Family Health",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Needs attention" }),
    ).toBeChecked();
    expect(
      screen.getByText("Everyone seen once a year, nothing chased twice."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "New Thread in Family Health" }),
    ).toBeVisible();
    // The title is the way through to the page.
    expect(screen.getByRole("link", { name: "Family Health" })).toHaveAttribute(
      "href",
      "/family-health",
    );
  });

  it("opens from the keyboard on the focused trigger", async () => {
    const user = userEvent.setup();
    renderPanel();

    openTrigger().focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Standard")).toBeVisible();
  });

  it("says where the Standard is written when the Area has none", async () => {
    const user = userEvent.setup();
    renderPanel({ standard: undefined });

    await user.click(openTrigger());

    expect(
      await screen.findByText(/No Standard yet — write it on the Area page\./),
    ).toBeVisible();
  });

  it("writes the chosen Condition through areas.update", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(openTrigger());
    await user.click(await screen.findByRole("radio", { name: "Critical" }));

    await waitFor(() =>
      expect(mocks.mutation).toHaveBeenCalledWith("areas:update", {
        condition: "critical",
        id: "area1",
      }),
    );
  });

  it("closes before handing capture to the host, carrying the Area", async () => {
    const user = userEvent.setup();
    const { onNewThread } = renderPanel();

    await user.click(openTrigger());
    await user.click(
      await screen.findByRole("button", {
        name: "New Thread in Family Health",
      }),
    );

    expect(onNewThread).toHaveBeenCalledWith("area1");
    // The panel is gone by the time the dialog would claim focus.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "New Thread in Family Health" }),
      ).toBeNull(),
    );
  });

  it("closes on Escape and gives the trigger its focus back", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(openTrigger());
    await screen.findByText("Standard");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Standard")).toBeNull());
    expect(openTrigger()).toHaveFocus();
  });
});
