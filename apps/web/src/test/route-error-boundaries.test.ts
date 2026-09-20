import { describe, expect, it } from "vitest";

/**
 * Every full-page route declares a boundary.
 *
 * The fallbacks themselves belong to the shared application and are tested
 * there; what a host owns is mounting them, which is what this checks. Code
 * splitting rewrites file-route components into lazy shells, so this guards the
 * wiring rather than the rendering.
 */
describe("full-page routes", () => {
  it.each([
    ["root", () => import("@/routes/__root")],
    ["authenticated layout", () => import("@/routes/_authenticated/route")],
    ["unauthenticated layout", () => import("@/routes/_unauthenticated/route")],
    ["sign in", () => import("@/routes/_unauthenticated/sign-in")],
    ["sign up", () => import("@/routes/_unauthenticated/sign-up")],
  ])("declares an error boundary for the %s route", async (_name, load) => {
    const { Route } = await load();

    expect(Route.options.errorComponent).toBeDefined();
  });
});
