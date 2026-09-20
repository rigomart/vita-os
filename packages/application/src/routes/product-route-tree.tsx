import {
  createRootRoute,
  createRoute,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";

import type { ProductSearch } from "../navigation/search-params";

import { AreaDetailScreen } from "../areas/area-detail/area-detail-screen";
import { DashboardScreen } from "../dashboard/screens/dashboard-screen";
import { InboxDeepLinkRedirect } from "../inbox/surface/inbox-deep-link-redirect";
import { AppShell } from "../layout/app-shell";
import { AppErrorFallback, RouteErrorFallback } from "../layout/error-boundary";
import { readProductSearch } from "../navigation/search-params";
import { useSessionGate } from "../viewer/session-gate";

/**
 * Vita OS' routes, as the application's own.
 *
 * The product's addresses are part of the product: `/` is the Dashboard,
 * `/$areaSlug` an Area, `/$areaSlug/$threadSlug` a Thread deep link, and
 * `?thread=`/`?inbox=` summon a Thread or the Notes panel over whatever is
 * showing. A host mounts this tree, adds whatever routes are its own — signing
 * in is the host's, not the product's — and hands the result to `createRouter`.
 *
 * These are code-based routes rather than files so the application, not its
 * host's build, decides them. Screen hooks use route IDs to avoid importing this
 * composition module back into the screens it mounts.
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

/**
 * The gate in front of the product, and the shell every screen sits in.
 *
 * What the search parameters mean is the application's own question, so this
 * route validates them through the application's reader; who is here is the
 * host's, so it defers to the gate the host provided.
 */
export const authenticatedRoute = createRoute({
  getParentRoute: () => productRootRoute,
  id: "_authenticated",
  validateSearch: (search: Record<string, unknown>): ProductSearch =>
    readProductSearch(search),
  errorComponent: RouteErrorFallback,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const Gate = useSessionGate();

  return (
    <Gate>
      <AppShell>
        <Outlet />
      </AppShell>
    </Gate>
  );
}

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  head: () => ({
    meta: [{ title: "Dashboard | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: DashboardScreen,
});

/**
 * An Area's page, and the Thread deep link nested under it.
 *
 * The Thread pane itself is rendered globally by `AppShell`, which reads this
 * route's params; the child route exists purely so `/$areaSlug/$threadSlug`
 * keeps matching.
 */
export const areaRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/$areaSlug",
  errorComponent: RouteErrorFallback,
  component: AreaLayout,
});

function AreaLayout() {
  const { areaSlug } = areaRoute.useParams();

  return (
    <>
      <AreaDetailScreen areaSlug={areaSlug} />
      <Outlet />
    </>
  );
}

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

/**
 * The Inbox has no page of its own — it is summoned over whatever is showing —
 * so both of its old addresses survive as deep links onto the Dashboard with it
 * open.
 */
const inboxRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/inbox",
  errorComponent: RouteErrorFallback,
  component: InboxDeepLinkRedirect,
});

const notesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/notes",
  errorComponent: RouteErrorFallback,
  component: InboxDeepLinkRedirect,
});

/** The authenticated product, ready for a host to hang off the root route. */
export const authenticatedRouteTree = authenticatedRoute.addChildren([
  dashboardRoute,
  areaRoute.addChildren([areaIndexRoute, threadDeepLinkRoute]),
  inboxRoute,
  notesRoute,
]);
