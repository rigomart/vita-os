import { onlineManager } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import {
  AppErrorBoundary,
  ApplicationClientProvider,
  authenticatedRouteTree,
  initializeTheme,
  productRootRoute,
  RouteErrorFallback,
  SessionGateProvider,
  ThemeProvider,
  useTheme,
  ViewerProvider,
} from "@vita-os/application";
import { Toaster } from "@vita-os/ui/components/sonner";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { type PropsWithChildren, StrictMode } from "react";
import { createRoot } from "react-dom/client";

import type { VitaBridge } from "../bridge.ts";

import { createBridgeClient } from "./bridge-client.ts";
import "@vita-os/ui/globals.css";

declare global {
  interface Window {
    vita: VitaBridge;
  }
}

initializeTheme();

// The data is on this computer, so the network being off pauses nothing.
// TanStack Query would otherwise hold every read and write until it is back.
onlineManager.setEventListener(() => undefined);
onlineManager.setOnline(true);

/**
 * The desktop host's composition: the product's own route tree and screens, as
 * the browser host mounts them, over the local client in main. There is no
 * account, so the gate lets everyone through and there is no Sign out.
 */
const client = createBridgeClient(window.vita);

const router = createRouter({
  routeTree: productRootRoute.addChildren([authenticatedRouteTree]),
  defaultErrorComponent: RouteErrorFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function LocalSessionGate({ children }: PropsWithChildren) {
  return children;
}

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <ApplicationClientProvider client={client}>
          <ViewerProvider viewer={{}}>
            <SessionGateProvider gate={LocalSessionGate}>
              <FeedbackProvider>
                <RouterProvider router={router} />
                <ThemeAwareToaster />
              </FeedbackProvider>
            </SessionGateProvider>
          </ViewerProvider>
        </ApplicationClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
