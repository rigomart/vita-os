import { createRouter } from "@tanstack/react-router";
import {
  authenticatedRouteTree,
  productRootRoute,
  RouteErrorFallback,
} from "@vita-os/application";

import { unauthenticatedRouteTree } from "./unauthenticated-routes";

/**
 * The browser host's route tree and router.
 *
 * The product's addresses belong to the shared application, which hands them
 * over as `authenticatedRouteTree` under its own root route; what this host adds
 * is the way in. Registering the router's types is the host's job too — it is
 * the only place that knows the whole tree.
 */
const routeTree = productRootRoute.addChildren([
  authenticatedRouteTree,
  unauthenticatedRouteTree,
]);

// Every match gets a branded boundary; routes that own the whole viewport
// override this with the full-page `AppErrorFallback`.
export const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
