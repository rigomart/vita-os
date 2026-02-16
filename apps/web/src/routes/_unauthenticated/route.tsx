import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";

export const Route = createFileRoute("/_unauthenticated")({
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
    <div className="flex min-h-screen items-center justify-center">
      <Outlet />
    </div>
  );
}
