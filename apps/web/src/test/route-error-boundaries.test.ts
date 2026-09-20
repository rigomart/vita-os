import { authenticatedRouteTree, productRootRoute } from "@vita-os/application";
import { describe, expect, it } from "vitest";

import {
  signInRoute,
  signUpRoute,
  unauthenticatedRoute,
} from "@/routing/unauthenticated-routes";

/**
 * Every full-page route declares a boundary.
 *
 * The fallbacks themselves belong to the shared application and are tested
 * there; what a host owns is mounting them — its own routes, and the product's
 * root and authenticated layout it hangs them beside.
 */
describe("full-page routes", () => {
  it.each([
    ["root", productRootRoute],
    ["authenticated layout", authenticatedRouteTree],
    ["unauthenticated layout", unauthenticatedRoute],
    ["sign in", signInRoute],
    ["sign up", signUpRoute],
  ])("declares an error boundary for the %s route", (_name, route) => {
    expect(route.options.errorComponent).toBeDefined();
  });
});
