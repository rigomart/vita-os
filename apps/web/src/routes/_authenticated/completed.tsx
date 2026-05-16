import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorFallback } from "@/components/error-boundary";
import { CompletedScreen } from "@/features/completed/screens/completed-screen";

export const Route = createFileRoute("/_authenticated/completed")({
  head: () => ({
    meta: [{ title: "Completed | Vita OS" }],
  }),
  errorComponent: RouteErrorFallback,
  component: CompletedRoute,
});

function CompletedRoute() {
  return <CompletedScreen />;
}
