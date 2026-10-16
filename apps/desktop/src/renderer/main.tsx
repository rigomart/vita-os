import { onlineManager } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import {
  AppErrorBoundary,
  ApplicationClientProvider,
  authenticatedRouteTree,
  HostCommandsProvider,
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
import { type PropsWithChildren, StrictMode, useEffect } from "react";
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
 * account, so the gate lets everyone through and there is no Sign out. The
 * menu bar's File commands reach the shell as the header's buttons do.
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

/** The window's background and native controls follow the product's theme. */
function NativeTheme() {
  const { theme } = useTheme();
  useEffect(() => window.vita.setTheme(theme), [theme]);
  return null;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <NativeTheme />
        <ApplicationClientProvider client={client}>
          <ViewerProvider viewer={{}} downloadData={window.vita.downloadData}>
            <SessionGateProvider gate={LocalSessionGate}>
              <HostCommandsProvider subscribe={window.vita.onCommand}>
                <FeedbackProvider>
                  <RouterProvider router={router} />
                  <ThemeAwareToaster />
                </FeedbackProvider>
              </HostCommandsProvider>
            </SessionGateProvider>
          </ViewerProvider>
        </ApplicationClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
