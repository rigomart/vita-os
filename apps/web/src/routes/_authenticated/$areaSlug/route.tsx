import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RouteErrorFallback } from "@vita-os/application";
import { AreaDetailScreen } from "@vita-os/application";

export const Route = createFileRoute("/_authenticated/$areaSlug")({
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
