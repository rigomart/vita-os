import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@vita-os/ui/components/sidebar";
import { useConvexAuth } from "convex/react";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { RouteErrorFallback } from "@/components/error-boundary";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  NavPrototypeSwitcher,
  useNavVariant,
} from "@/components/layout/prototype/nav-prototype-switcher";
import { NavVariantPaletteFirst } from "@/components/layout/prototype/nav-variant-palette";
import { NavVariantSlimRail } from "@/components/layout/prototype/nav-variant-rail";
import { NavVariantTopBar } from "@/components/layout/prototype/nav-variant-topbar";

export const Route = createFileRoute("/_authenticated")({
  errorComponent: RouteErrorFallback,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  // PROTOTYPE (issue #247): nav-chrome variants, dev-only, `?variant=` switched.
  // Remove the branching below (and components/layout/prototype/) when settled.
  const [variant, setVariant] = useNavVariant();

  if (isLoading) {
    return <AuthVerifyingLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" />;
  }

  const content = <Outlet />;

  return (
    <>
      {variant === "current" && (
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="overflow-x-hidden">
            <AppHeader />
            <main className="w-full px-4 pt-3 pb-8">{content}</main>
          </SidebarInset>
        </SidebarProvider>
      )}
      {variant === "A" && <NavVariantTopBar>{content}</NavVariantTopBar>}
      {variant === "B" && <NavVariantSlimRail>{content}</NavVariantSlimRail>}
      {variant === "C" && (
        <NavVariantPaletteFirst>{content}</NavVariantPaletteFirst>
      )}
      <NavPrototypeSwitcher variant={variant} onVariantChange={setVariant} />
    </>
  );
}
