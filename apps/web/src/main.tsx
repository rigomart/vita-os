import { createRouter, RouterProvider } from "@tanstack/react-router";
import {
  AppErrorBoundary,
  ApplicationClientProvider,
  initializeTheme,
  RouteErrorFallback,
  ThemeProvider,
  useTheme,
  ViewerProvider,
} from "@vita-os/application";
import { Toaster } from "@vita-os/ui/components/sonner";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createHttpApplicationClient } from "./application/http/http-application-client";
import { authClient } from "./lib/auth-client";
import { API_BASE_URL } from "./lib/env";
import { routeTree } from "./routeTree.gen";
import "@vita-os/ui/globals.css";

initializeTheme();

/**
 * The browser host's composition.
 *
 * It owns exactly what the shared application cannot: Better Auth in the
 * browser, the runtime API address, the HTTP implementation of the application
 * contract, and the route tree this build generates. Everything above that — the
 * product screens, the cache, the optimistic behavior — belongs to
 * `@vita-os/application`, which a desktop host can mount the same way against a
 * local client.
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
          <SignedInViewer>
            <FeedbackProvider>
              <RouterProvider router={router} />
              <ThemeAwareToaster />
            </FeedbackProvider>
          </SignedInViewer>
        </ApplicationClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

/**
 * Who the product is for, translated out of Better Auth.
 *
 * This is the only place the browser's authentication meets the shared
 * application: it hands over a name, an avatar, and a way out, and nothing about
 * sessions or cookies travels any further.
 */
function SignedInViewer({ children }: { children: React.ReactNode }) {
  const { data } = authClient.useSession();

  return (
    <ViewerProvider
      viewer={data?.user}
      signOut={() => void authClient.signOut()}
    >
      {children}
    </ViewerProvider>
  );
}

function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} />;
}
