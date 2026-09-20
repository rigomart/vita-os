import {
  createRootRoute,
  createRoute,
  HeadContent,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";

import { AppErrorFallback, RouteErrorFallback } from "../layout/error-boundary";
import { readProductSearch } from "../navigation/search-params";

/**
 * Vita OS' routes, as the application's own.
 *
 * The product's addresses are part of the product: `/` is the Dashboard,
 * `/$areaSlug` an Area, `/$areaSlug/$threadSlug` a Thread deep link, and
 * `?thread=`/`?inbox=` summon a Thread or the Notes panel over whatever is
 * showing. A host mounts this tree, adds whatever routes are its own — signing
 * in is the host's, not the product's — and hands the result to `createRouter`.
 *
 * Every component below is loaded lazily, which is what keeps the authenticated
 * app out of the bundle a signed-out visitor downloads. `check-chunks.mjs`
 * fails the build if that stops being true.
 */
export const productRootRoute = createRootRoute({
  head: () => ({
    meta: [
      { title: "Vita OS" },
      {
        name: "description",
        content: "A personal operating system for notes, threads, and goals.",
      },
    ],
  }),
  errorComponent: AppErrorFallback,
  component: ProductRoot,
});

function ProductRoot() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}

export const authenticatedRoute = createRoute({
  getParentRoute: () => productRootRoute,
  id: "_authenticated",
  validateSearch: readProductSearch,
  errorComponent: RouteErrorFallback,
  component: lazyRouteComponent(
    () => import("./authenticated-layout"),
    "AuthenticatedLayout",
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  head: () => ({
    meta: [{ title: "Dashboard | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: lazyRouteComponent(
    () => import("../dashboard/screens/dashboard-screen"),
    "DashboardScreen",
  ),
});

/**
 * The Thread pane itself is rendered globally by `AppShell`, which reads this
 * route's params; the child routes exist purely so `/$areaSlug/$threadSlug`
 * keeps matching.
 */
export const areaRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/$areaSlug",
  errorComponent: RouteErrorFallback,
  component: lazyRouteComponent(() => import("./area-layout"), "AreaLayout"),
});

function renderNothing() {
  return null;
}

const areaIndexRoute = createRoute({
  getParentRoute: () => areaRoute,
  path: "/",
  errorComponent: RouteErrorFallback,
  component: renderNothing,
});

export const threadDeepLinkRoute = createRoute({
  getParentRoute: () => areaRoute,
  path: "/$threadSlug",
  errorComponent: RouteErrorFallback,
  component: renderNothing,
});

const inboxDeepLink = lazyRouteComponent(
  () => import("../inbox/surface/inbox-deep-link-redirect"),
  "InboxDeepLinkRedirect",
);

/**
 * The Inbox has no page of its own — it is summoned over whatever is showing —
 * so both of its old addresses survive as deep links onto the Dashboard with it
 * open.
 */
const inboxRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/inbox",
  errorComponent: RouteErrorFallback,
  component: inboxDeepLink,
});

const notesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/notes",
  errorComponent: RouteErrorFallback,
  component: inboxDeepLink,
});

export const authenticatedRouteTree = authenticatedRoute.addChildren([
  dashboardRoute,
  areaRoute.addChildren([areaIndexRoute, threadDeepLinkRoute]),
  inboxRoute,
  notesRoute,
]);
