import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ApplicationClientProvider } from "@vita-os/application";
import { Toaster } from "@vita-os/ui/components/sonner";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createHttpApplicationClient } from "./application/http/http-application-client";
import {
  AppErrorBoundary,
  RouteErrorFallback,
} from "./components/error-boundary";
import {
  initializeTheme,
  ThemeProvider,
  useTheme,
} from "./features/theme/theme-provider";
import { API_BASE_URL } from "./lib/env";
import { routeTree } from "./routeTree.gen";
import "@vita-os/ui/globals.css";

initializeTheme();

/**
 * The browser host's composition.
 *
 * It owns exactly three things the shared application does not: Better Auth in
 * the browser, the runtime API address, and the HTTP implementation of the
 * application contract. Everything above that — the product screens, the cache,
 * the optimistic behavior — belongs to `@vita-os/application`.
 */
const applicationClient = createHttpApplicationClient({
  apiBaseUrl: API_BASE_URL,
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
        <ApplicationClientProvider client={applicationClient}>
          <FeedbackProvider>
            <RouterProvider router={router} />
            <ThemeAwareToaster />
          </FeedbackProvider>
        </ApplicationClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} />;
}
