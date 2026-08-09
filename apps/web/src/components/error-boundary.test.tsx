import type { ErrorComponentProps } from "@tanstack/react-router";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import {
  AppErrorBoundary,
  AppErrorFallback,
  RouteErrorFallback,
} from "./error-boundary";

function Boom(): never {
  throw new Error("kaboom");
}

function errorProps(reset: () => void) {
  return {
    error: new Error("kaboom"),
    reset,
  } as unknown as ErrorComponentProps & { reset: () => void };
}

describe("error boundaries", () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockClear();
    // React logs caught render errors; keep the run readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("catches a crash above the router and offers a reload", async () => {
    const user = userEvent.setup();

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText("Something went wrong")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("renders children when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("all good")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retries or reloads from the full-page route fallback", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(<AppErrorFallback {...errorProps(reset)} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("retries from the inline route fallback", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(<RouteErrorFallback {...errorProps(reset)} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("full-page routes", () => {
  it.each([
    ["root", () => import("@/routes/__root")],
    ["unauthenticated layout", () => import("@/routes/_unauthenticated/route")],
    ["sign in", () => import("@/routes/_unauthenticated/sign-in")],
    ["sign up", () => import("@/routes/_unauthenticated/sign-up")],
  ])("declares an error boundary for the %s route", async (_name, load) => {
    const { Route } = await load();
    // Code splitting rewrites file-route components into lazy shells, so this
    // guards the wiring; the screen itself is rendered in the tests above.
    expect(Route.options.errorComponent).toBeDefined();
  });
});
