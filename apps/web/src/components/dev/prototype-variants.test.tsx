import type { ReactNode } from "react";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { PrototypeVariants, type PrototypeVariant } from "./prototype-variants";

const variants = [
  { key: "A", name: "Command center", render: () => <p>Variant A</p> },
  { key: "B", name: "Daily focus", render: () => <p>Variant B</p> },
  { key: "C", name: "Timeline", render: () => <p>Variant C</p> },
] satisfies readonly [PrototypeVariant, ...PrototypeVariant[]];

function renderWithRouter(ui: ReactNode, initialEntry = "/") {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  render(<RouterContextProvider router={router}>{ui}</RouterContextProvider>);

  return router;
}

describe("PrototypeVariants", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("renders the first variant by default", () => {
    renderWithRouter(<PrototypeVariants variants={variants} />);

    expect(screen.getByText("Variant A")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "A — Command center" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the URL-selected variant", () => {
    renderWithRouter(<PrototypeVariants variants={variants} />, "/?variant=C");

    expect(screen.getByText("Variant C")).toBeVisible();
    expect(screen.queryByText("Variant A")).not.toBeInTheDocument();
  });

  it("selects variants directly and keeps other search params", async () => {
    const user = userEvent.setup();
    const router = renderWithRouter(
      <PrototypeVariants variants={variants} />,
      "/?panel=open",
    );

    await user.click(screen.getByRole("button", { name: "B — Daily focus" }));

    await waitFor(() => expect(screen.getByText("Variant B")).toBeVisible());
    expect(router.state.location.search).toEqual({
      panel: "open",
      variant: "B",
    });
  });

  it("wraps with arrow controls and ignores shortcuts while typing", async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <>
        <input aria-label="Prototype input" />
        <PrototypeVariants variants={variants} />
      </>,
    );

    await user.click(
      screen.getByRole("button", { name: "Previous prototype variant" }),
    );
    await waitFor(() => expect(screen.getByText("Variant C")).toBeVisible());

    const input = screen.getByRole("textbox", { name: "Prototype input" });
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(screen.getByText("Variant C")).toBeVisible();

    input.blur();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByText("Variant A")).toBeVisible());
  });

  it("moves the toolbar and remembers its position for the browser tab", async () => {
    const user = userEvent.setup();
    renderWithRouter(<PrototypeVariants variants={variants} />);

    expect(screen.queryByText("Prototype")).not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Prototype variants" }),
    ).toHaveAttribute("data-position", "bottom");

    await user.click(
      screen.getByRole("button", {
        name: "Move prototype toolbar (currently bottom)",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Move toolbar to top" }),
    );

    expect(
      screen.getByRole("complementary", { name: "Prototype variants" }),
    ).toHaveAttribute("data-position", "top");
    expect(
      window.sessionStorage.getItem("vita-os:prototype-toolbar-position"),
    ).toBe("top");

    cleanup();
    renderWithRouter(<PrototypeVariants variants={variants} />);

    expect(
      screen.getByRole("complementary", { name: "Prototype variants" }),
    ).toHaveAttribute("data-position", "top");
  });
});
