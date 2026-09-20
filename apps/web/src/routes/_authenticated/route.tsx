import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import {
  AppShell,
  readProductSearch,
  RouteErrorFallback,
  type ProductSearch,
} from "@vita-os/application";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { useSessionGate } from "@/lib/session";

/**
 * The gate in front of the product.
 *
 * Whether somebody is signed in is the host's question; what the search
 * parameters mean is the shared application's, so this route validates them
 * through the application's own reader rather than restating them.
 */
export const Route = createFileRoute("/_authenticated")({
  validateSearch: (search: Record<string, unknown>): ProductSearch =>
    readProductSearch(search),
  errorComponent: RouteErrorFallback,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useSessionGate();

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
