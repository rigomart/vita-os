import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
// PROTOTYPE — issue #314. Remove with the prototype directory.
import { DashboardPrototype } from "@/features/dashboard/prototype/dashboard-prototype";
import { DashboardScreen } from "@/features/dashboard/screens/dashboard-screen";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [{ title: "Dashboard | Vita OS" }],
  }),
  // PROTOTYPE — issue #314. `?variant=A|B|C|D` swaps the Dashboard for a
  // throwaway variation; `?narrow=true` constrains the viewport;
  // `?source=live` runs it against real data instead of the fixture.
  validateSearch: (
    search: Record<string, unknown>,
  ): { narrow?: true; source?: "live"; variant?: string } => ({
    variant:
      typeof search.variant === "string" && search.variant.length > 0
        ? search.variant.toUpperCase()
        : undefined,
    narrow:
      search.narrow === true || search.narrow === "true" ? true : undefined,
    source: search.source === "live" ? "live" : undefined,
  }),
  errorComponent: RouteErrorFallback,
  component: DashboardRoute,
});

function DashboardRoute() {
  const { narrow, source, variant } = Route.useSearch();

  if (import.meta.env.DEV && variant) {
    return (
      <DashboardPrototype
        narrow={narrow === true}
        source={source === "live" ? "live" : "fixture"}
        variant={variant}
      />
    );
  }

  return <DashboardScreen />;
}
