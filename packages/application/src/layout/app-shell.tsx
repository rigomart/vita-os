import type { ReactNode } from "react";

import { ActionBar } from "./action-bar";
import { ShellBehavior, useShellActions } from "./shell-behavior";
import { SkyHeader } from "./sky-header";

/** The product's shell: its behavior, and the chrome it draws around a page. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ShellBehavior>
      <Chrome>{children}</Chrome>
    </ShellBehavior>
  );
}

/**
 * The sky header above the page and, below `lg`, the action bar over its foot.
 * The header's actions do not clear `--rail`, so an open Thread pane covers
 * them on a wide screen (ADR 0037).
 */
function Chrome({ children }: { children: ReactNode }) {
  const actions = useShellActions();
  return (
    // A grid, not a flex column, so `main` gets a definite height under the
    // header that a page can fill with `min-h-full`.
    <div className="grid min-h-svh min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr]">
      <SkyHeader {...actions} />
      {/* Below `lg` the action bar floats over the page's foot, so the page
          keeps that much room under its last item. */}
      <main className="w-full min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>
      <ActionBar {...actions} />
    </div>
  );
}
