import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-boundary";
import { DashboardScreen } from "@/features/dashboard/screens/dashboard-screen";

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
