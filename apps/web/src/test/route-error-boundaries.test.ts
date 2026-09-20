import { describe, expect, it } from "vitest";

import { Route as rootRoute } from "@/routes/__root";
import { Route as authenticatedRoute } from "@/routes/_authenticated/route";
import { Route as unauthenticatedRoute } from "@/routes/_unauthenticated/route";
import { Route as signInRoute } from "@/routes/_unauthenticated/sign-in";
import { Route as signUpRoute } from "@/routes/_unauthenticated/sign-up";

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
    ["root", rootRoute],
    ["authenticated layout", authenticatedRoute],
    ["unauthenticated layout", unauthenticatedRoute],
    ["sign in", signInRoute],
    ["sign up", signUpRoute],
  ])("declares an error boundary for the %s route", (_name, route) => {
    expect(route.options.errorComponent).toBeDefined();
  });
});
