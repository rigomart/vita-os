import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AppErrorFallback } from "@/components/error-boundary";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: "Vita OS" },
      {
        name: "description",
        content: "A personal operating system for tasks, threads, and goals.",
      },
    ],
  }),
  errorComponent: AppErrorFallback,
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  );
}
