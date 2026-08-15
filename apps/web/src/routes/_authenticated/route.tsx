import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { RouteErrorFallback } from "@/components/error-boundary";
import { AppShell } from "@/components/layout/app-shell";

// PROTOTYPE (issue #280) — `variant` gates throwaway thread-view mockups;
// remove together with src/features/threads/thread-detail/prototype/.
const PROTOTYPE_VARIANTS = ["a", "b", "c", "d", "e"] as const;
export type PrototypeVariant = (typeof PROTOTYPE_VARIANTS)[number];

export const Route = createFileRoute("/_authenticated")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { thread?: string; variant?: PrototypeVariant } => ({
    thread:
      typeof search.thread === "string" && search.thread.length > 0
        ? search.thread
        : undefined,
    variant: PROTOTYPE_VARIANTS.includes(search.variant as PrototypeVariant)
      ? (search.variant as PrototypeVariant)
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
