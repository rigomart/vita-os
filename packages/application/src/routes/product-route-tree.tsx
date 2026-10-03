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
 * The product's addresses are part of the product: `/` is the Dashboard
 * (`?area=` or `?show=notes` filters it), `/threads/$threadSlug` a Thread deep
 * link, and `?thread=` summons a Thread over whatever is showing. The old
 * addresses redirect: the Area pages, `/$areaSlug` and
 * `/$areaSlug/$threadSlug`, and the Notes panel, `/notes`, `/inbox` and
 * `?inbox=true`. A host mounts this tree, adds whatever routes are its own —
 * signing in is the host's, not the product's — and hands the result to
 * `createRouter`.
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

const dashboardScreen = lazyRouteComponent(
  () => import("../dashboard/screens/dashboard-screen"),
  "DashboardScreen",
);

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  head: () => ({
    meta: [{ title: "Dashboard | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: dashboardScreen,
});

/**
 * A Thread's own address. The pane itself is rendered globally by `AppShell`,
 * which reads this route's params; the Dashboard sits underneath it, so closing
 * the pane leaves the person somewhere useful. The static `threads` segment
 * takes precedence over any Area slug.
 */
export const threadDeepLinkRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/threads/$threadSlug",
  errorComponent: RouteErrorFallback,
  component: dashboardScreen,
});

const legacyAreaRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/$areaSlug",
  errorComponent: RouteErrorFallback,
  component: lazyRouteComponent(
    () => import("./legacy-area-redirects"),
    "LegacyAreaRedirect",
  ),
});

const legacyAreaThreadRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/$areaSlug/$threadSlug",
  errorComponent: RouteErrorFallback,
  component: lazyRouteComponent(
    () => import("./legacy-area-redirects"),
    "LegacyAreaThreadRedirect",
  ),
});

const notesDeepLink = lazyRouteComponent(
  () => import("./notes-deep-link-redirect"),
  "NotesDeepLinkRedirect",
);

/**
 * Notes live on the Dashboard, so both old addresses of the Notes panel land
 * there with the Notes filter selected. The static segments win over an Area
 * slug, as `threads` does.
 */
const inboxRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/inbox",
  errorComponent: RouteErrorFallback,
  component: notesDeepLink,
});

const notesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/notes",
  errorComponent: RouteErrorFallback,
  component: notesDeepLink,
});

export const authenticatedRouteTree = authenticatedRoute.addChildren([
  dashboardRoute,
  threadDeepLinkRoute,
  inboxRoute,
  notesRoute,
  legacyAreaRoute,
  legacyAreaThreadRoute,
]);
