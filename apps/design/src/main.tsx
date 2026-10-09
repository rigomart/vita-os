import { createRouter, RouterProvider } from "@tanstack/react-router";
import {
  AppErrorBoundary,
  initializeTheme,
  RouteErrorFallback,
  SessionGateProvider,
  ThemeProvider,
  useTheme,
} from "@vita-os/application";
import { Toaster } from "@vita-os/ui/components/sonner";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { type PropsWithChildren, StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { LabApplication } from "./lab/lab-application";
import { labRouteTree } from "./lab/lab-routes";
import { LabToolbar } from "./lab/lab-toolbar";
import "@vita-os/ui/globals.css";

initializeTheme();

/**
 * The lab's composition: the product's own route tree and screens, as the
 * browser host mounts them, over an in-memory client instead of the API, with
 * the lab's pages beside them. Nobody signs in; the gate lets everyone through.
 */
const router = createRouter({
  routeTree: labRouteTree(),
  defaultErrorComponent: RouteErrorFallback,
  InnerWrap: ({ children }) => (
    <>
      {children}
      <LabToolbar />
    </>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function OpenGate({ children }: PropsWithChildren) {
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
        <LabApplication>
          <SessionGateProvider gate={OpenGate}>
            <FeedbackProvider>
              <RouterProvider router={router} />
              <ThemeAwareToaster />
            </FeedbackProvider>
          </SessionGateProvider>
        </LabApplication>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
