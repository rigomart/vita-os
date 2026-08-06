// PROTOTYPE (issue #247) — THROWAWAY CODE, do not ship.
// Variant C — direction 4 as the primary affordance: minimal top bar where the
// ⌘K palette is how you go anywhere. Chrome keeps only brand, search, Inbox
// awareness (badge), New task, and the user menu. On mobile (direction 3):
// bottom tab bar with Dashboard / Inbox / New task.

import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { Kbd } from "@vita-os/ui/components/kbd";
import { Inbox, Search } from "lucide-react";
import { useState } from "react";

import { useGlobalNewTaskShortcut } from "@/features/sidebar/use-global-new-task-shortcut";
import { useSidebarDialogs } from "@/features/sidebar/use-sidebar-dialogs";
import { cn } from "@/lib/utils";

import {
  NavPrototypePalette,
  usePaletteShortcut,
} from "./nav-prototype-palette";
import {
  InboxTaskCountBadge,
  MobileBottomTabs,
  NavPrototypeDialogs,
  NavPrototypeLogo,
  NavPrototypeUserMenu,
  NewTaskButton,
  useNavPrototypeData,
} from "./nav-prototype-shared";

export function NavVariantPaletteFirst({ children }: { children: ReactNode }) {
  const data = useNavPrototypeData();
  const dialogs = useSidebarDialogs();
  useGlobalNewTaskShortcut(dialogs.openNewTask);
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(() => setPaletteOpen(true));

  const { taskCount, pathname } = data;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-12 items-center gap-3 px-4">
          <NavPrototypeLogo />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mx-auto flex h-8 w-full max-w-xs items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted sm:max-w-sm"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Jump anywhere…</span>
            <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
          </button>

          <div className="flex items-center gap-2">
            <Link
              to="/inbox"
              aria-label="Inbox"
              className={cn(
                "relative hidden size-8 items-center justify-center rounded-md transition-colors md:flex",
                pathname === "/inbox"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Inbox className="size-4" />
              <span className="absolute -top-1 -right-1">
                <InboxTaskCountBadge taskCount={taskCount} />
              </span>
            </Link>
            <span className="hidden md:inline-flex">
              <NewTaskButton onClick={dialogs.openNewTask} iconOnly />
            </span>
            <NavPrototypeUserMenu />
          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-4 pt-3 pb-24 md:pb-8">{children}</main>

      <MobileBottomTabs taskCount={taskCount} onNewTask={dialogs.openNewTask} />
      <NavPrototypeDialogs controller={dialogs} areas={data.areas} />
      <NavPrototypePalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        data={data}
        dialogs={dialogs}
      />
    </div>
  );
}
