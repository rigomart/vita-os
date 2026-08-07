import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { RouteErrorFallback } from "@/components/error-boundary";
import { AppShell } from "@/components/layout/app-shell";

// PROTOTYPE: `variant` gates the throwaway dashboard direction prototypes
// (?variant=a|b|c on "/"). Remove together with the prototype folder.
export const Route = createFileRoute("/_authenticated")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { thread?: string; variant?: "a" | "b" | "c" } => ({
    thread:
      typeof search.thread === "string" && search.thread.length > 0
        ? search.thread
        : undefined,
    variant:
      search.variant === "a" || search.variant === "b" || search.variant === "c"
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
