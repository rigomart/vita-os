import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorFallback } from "@vita-os/application";
import { DashboardScreen } from "@vita-os/application";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [{ title: "Dashboard | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: DashboardRoute,
});

function DashboardRoute() {
  return <DashboardScreen />;
}
