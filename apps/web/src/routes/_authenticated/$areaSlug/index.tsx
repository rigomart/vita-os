import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorFallback } from "@vita-os/application";

export const Route = createFileRoute("/_authenticated/$areaSlug/")({
  errorComponent: RouteErrorFallback,
  component: AreaRoute,
});

function AreaRoute() {
  return null;
}
