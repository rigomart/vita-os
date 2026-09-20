import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppErrorFallback } from "@vita-os/application";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { useSessionGate } from "@/lib/session";

export const Route = createFileRoute("/_unauthenticated")({
  errorComponent: AppErrorFallback,
  component: UnauthenticatedLayout,
});

function UnauthenticatedLayout() {
  const { isAuthenticated, isLoading } = useSessionGate();

  if (isLoading) {
    return <AuthVerifyingLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Outlet />
    </div>
  );
}
