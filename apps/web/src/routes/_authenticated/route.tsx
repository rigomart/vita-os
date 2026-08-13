import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { RouteErrorFallback } from "@/components/error-boundary";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_authenticated")({
  // PROTOTYPE(thread-view): `variant` gates the throwaway thread-view UI
  // variants — remove together with features/threads/thread-detail/prototype/.
  validateSearch: (
    search: Record<string, unknown>,
  ): { thread?: string; variant?: string } => ({
    thread:
      typeof search.thread === "string" && search.thread.length > 0
        ? search.thread
        : undefined,
    variant:
      typeof search.variant === "string" && search.variant.length > 0
        ? search.variant
        : undefined,
  }),
  errorComponent: RouteErrorFallback,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <AuthVerifyingLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
