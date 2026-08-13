import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { AreaDetailScreen } from "@/features/areas/area-detail/area-detail-screen";

export const Route = createFileRoute("/_authenticated/$areaSlug")({
  // PROTOTYPE — `?variant=` gates throwaway Area view design variants
  // (see features/areas/area-detail/prototype/). Remove with the prototype.
  validateSearch: (search: Record<string, unknown>): { variant?: string } => ({
    variant:
      typeof search.variant === "string" && search.variant.length > 0
        ? search.variant
        : undefined,
  }),
  errorComponent: RouteErrorFallback,
  component: AreaLayoutRoute,
});

function AreaLayoutRoute() {
  const { areaSlug } = Route.useParams();

  return (
    <>
      <AreaDetailScreen areaSlug={areaSlug} />
      {/* Child thread route renders null; the pane itself lives in AppShell. */}
      <Outlet />
    </>
  );
}
