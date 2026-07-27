import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { AreaDetailScreen } from "@/features/areas/area-detail/area-detail-screen";

export const Route = createFileRoute("/_authenticated/$areaSlug")({
  errorComponent: RouteErrorFallback,
  component: AreaLayoutRoute,
});

function AreaLayoutRoute() {
  const { areaSlug } = Route.useParams();

  return (
    <div
      data-slot="area-thread-workspace"
      className="flex min-h-[calc(100dvh-5.25rem)] min-w-0 items-start gap-4"
    >
      <div data-slot="area-content" className="min-w-0 flex-1">
        <AreaDetailScreen areaSlug={areaSlug} />
      </div>
      <Outlet />
    </div>
  );
}
