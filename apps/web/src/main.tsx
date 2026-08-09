import type { AuthClient } from "@convex-dev/better-auth/react";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@vita-os/ui/components/sonner";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  AppErrorBoundary,
  RouteErrorFallback,
} from "./components/error-boundary";
import {
  initializeTheme,
  ThemeProvider,
  useTheme,
} from "./features/theme/theme-provider";
import { authClient } from "./lib/auth-client";
import { routeTree } from "./routeTree.gen";
import "@vita-os/ui/globals.css";

initializeTheme();

if (!import.meta.env.VITE_CONVEX_URL) {
  throw new Error("VITE_CONVEX_URL is not set");
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL, {
  expectAuth: true,
});

// Every match gets a branded boundary; routes that own the whole viewport
// override this with the full-page `AppErrorFallback`.
const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <ConvexBetterAuthProvider
          client={convex}
          // The component's AuthClient union reduces useSession data to `never`
          // under TypeScript 7, despite this matching its documented plugin setup.
          authClient={authClient as unknown as AuthClient}
        >
          <ConvexQueryCacheProvider expiration={300_000}>
            <FeedbackProvider>
              <RouterProvider router={router} />
              <ThemeAwareToaster />
            </FeedbackProvider>
          </ConvexQueryCacheProvider>
        </ConvexBetterAuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} />;
}
