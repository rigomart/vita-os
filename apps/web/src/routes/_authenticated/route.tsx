import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { RouteErrorFallback } from "@/components/error-boundary";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_authenticated")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { thread?: string; inbox?: true } => ({
    thread:
      typeof search.thread === "string" && search.thread.length > 0
        ? search.thread
        : undefined,
    // `?inbox=true` summons the Inbox over whatever page is showing.
    inbox: search.inbox === true || search.inbox === "true" ? true : undefined,
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
