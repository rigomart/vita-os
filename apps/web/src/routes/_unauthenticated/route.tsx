import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { AppErrorFallback } from "@/components/error-boundary";

export const Route = createFileRoute("/_unauthenticated")({
  errorComponent: AppErrorFallback,
  component: UnauthenticatedLayout,
});

function UnauthenticatedLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();

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
