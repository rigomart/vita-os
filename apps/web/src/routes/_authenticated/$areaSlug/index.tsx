import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";

export const Route = createFileRoute("/_authenticated/$areaSlug/")({
  errorComponent: RouteErrorFallback,
  component: AreaRoute,
});

function AreaRoute() {
  return null;
}
