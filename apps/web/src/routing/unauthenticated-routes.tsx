import { createRoute, Navigate, Outlet } from "@tanstack/react-router";
import { AppErrorFallback, productRootRoute } from "@vita-os/application";

import { AuthVerifyingLoader } from "@/components/auth/auth-verifying-loader";
import { SignInScreen } from "@/features/auth/screens/sign-in-screen";
import { SignUpScreen } from "@/features/auth/screens/sign-up-screen";
import { useSessionGate } from "@/lib/session";

/**
 * The routes that are this host's own.
 *
 * Signing in and signing up are authentication, not product, so they live
 * beside Better Auth rather than in the shared application — a desktop host
 * would establish who is here some other way and mount none of this.
 */
export const unauthenticatedRoute = createRoute({
  getParentRoute: () => productRootRoute,
  id: "_unauthenticated",
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

export const signInRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: "/sign-in",
  head: () => ({
    meta: [
      { title: "Sign In | Vita OS" },
      {
        name: "description",
        content: "Sign in to your Vita OS account.",
      },
      { property: "og:title", content: "Sign In | Vita OS" },
      {
        property: "og:description",
        content: "Sign in to your Vita OS account.",
      },
    ],
  }),
  errorComponent: AppErrorFallback,
  component: SignInScreen,
});

export const signUpRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: "/sign-up",
  head: () => ({
    meta: [
      { title: "Sign Up | Vita OS" },
      {
        name: "description",
        content: "Create a Vita OS account to get started.",
      },
      { property: "og:title", content: "Sign Up | Vita OS" },
      {
        property: "og:description",
        content: "Create a Vita OS account to get started.",
      },
    ],
  }),
  errorComponent: AppErrorFallback,
  component: SignUpScreen,
});

export const unauthenticatedRouteTree = unauthenticatedRoute.addChildren([
  signInRoute,
  signUpRoute,
]);
