import "@fontsource-variable/rubik";
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: "Vita OS" },
      {
        name: "description",
        content: "A personal operating system for tasks, projects, and goals.",
      },
    ],
  }),
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
