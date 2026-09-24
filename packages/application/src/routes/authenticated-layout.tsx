import { Outlet } from "@tanstack/react-router";

import { AppShell } from "../layout/app-shell";
import { useSessionGate } from "../viewer/session-gate";

/**
 * The gate in front of the product, and the shell every screen sits in.
 *
 * Its own module so the route tree can reach it through `lazyRouteComponent`:
 * the shell pulls in the chrome, the command palette and the note composer, and
 * none of that should reach somebody who is still signed out.
 */
export function AuthenticatedLayout() {
  const Gate = useSessionGate();

  return (
    <Gate>
      <AppShell>
        <Outlet />
      </AppShell>
    </Gate>
  );
}
