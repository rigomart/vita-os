import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorFallback } from "@vita-os/application";

// The thread detail pane is rendered globally by AppShell (it reads this
// route's params via useMatch). The route exists purely so the deep-link URL
// /$areaSlug/$threadSlug keeps matching.
export const Route = createFileRoute("/_authenticated/$areaSlug/$threadSlug")({
  errorComponent: RouteErrorFallback,
  component: () => null,
});
