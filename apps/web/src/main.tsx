import { RouterProvider } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import {
  AppErrorBoundary,
  initializeTheme,
  SessionGateProvider,
  ThemeProvider,
  useTheme,
} from "@vita-os/application";
import { Toaster } from "@vita-os/ui/components/sonner";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createHttpApplicationClient } from "./application/http/http-application-client";
import { SignedInApplication } from "./application/signed-in-application";
import { API_BASE_URL } from "./lib/env";
import { BrowserSessionGate } from "./routing/browser-session-gate";
import { router } from "./routing/router";
import "@vita-os/ui/globals.css";

initializeTheme();

/**
 * The browser host's composition.
 *
 * It owns exactly what the shared application cannot: Better Auth in the
 * browser, the runtime API address, the HTTP implementation of the application
 * contract, and the gate in front of the product. Everything above that — the
 * routes, the product screens, the cache, the optimistic behavior — belongs to
 * `@vita-os/application`, which a desktop host can mount the same way against a
 * local client.
 */
const applicationClient = createHttpApplicationClient({
  apiBaseUrl: API_BASE_URL,
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <SignedInApplication client={applicationClient}>
          <SessionGateProvider gate={BrowserSessionGate}>
            <FeedbackProvider>
              <RouterProvider router={router} />
              <ThemeAwareToaster />
              {import.meta.env.DEV && (
                <TanStackRouterDevtools router={router} />
              )}
            </FeedbackProvider>
          </SessionGateProvider>
        </SignedInApplication>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} />;
}
