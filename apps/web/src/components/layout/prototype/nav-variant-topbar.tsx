// PROTOTYPE (issue #247) — THROWAWAY CODE, do not ship.
// Variant A — direction 1: no sidebar on desktop. Top bar with Dashboard,
// Inbox (badge), New task, user menu; breadcrumbs inside Areas/Threads with
// segment dropdowns (probing open question: reaching a *different* Area from
// deep inside a Thread). Desktop and mobile share one nav set.

import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  LayoutDashboard,
} from "lucide-react";
import { useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { useGlobalNewTaskShortcut } from "@/features/sidebar/use-global-new-task-shortcut";
import { useSidebarDialogs } from "@/features/sidebar/use-sidebar-dialogs";
import { cn } from "@/lib/utils";

import {
  NavPrototypePalette,
  usePaletteShortcut,
} from "./nav-prototype-palette";
import {
  InboxTaskCountBadge,
  NavPrototypeDialogs,
  NavPrototypeLogo,
  NavPrototypeUserMenu,
  NewTaskButton,
  useNavPrototypeData,
} from "./nav-prototype-shared";

export function NavVariantTopBar({ children }: { children: ReactNode }) {
  const data = useNavPrototypeData();
  const dialogs = useSidebarDialogs();
  useGlobalNewTaskShortcut(dialogs.openNewTask);
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(() => setPaletteOpen(true));

  const { taskCount, pathname } = data;

  const navLinkClassName = (active: boolean) =>
    cn(
      "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-muted text-foreground"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-12 items-center gap-2 px-4">
          <NavPrototypeLogo />
          <nav className="ml-2 flex items-center gap-1" aria-label="Primary">
            <Link to="/" className={navLinkClassName(pathname === "/")}>
              <LayoutDashboard className="size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <Link
              to="/inbox"
              className={navLinkClassName(pathname === "/inbox")}
            >
              <Inbox className="size-4" />
              <span className="hidden sm:inline">Inbox</span>
              <InboxTaskCountBadge taskCount={taskCount} />
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NewTaskButton onClick={dialogs.openNewTask} iconOnly />
            <NavPrototypeUserMenu />
          </div>
        </div>
      </header>

      <TopBarBreadcrumbs data={data} />

      <main className="w-full flex-1 px-4 pt-3 pb-8">{children}</main>

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

function TopBarBreadcrumbs({
  data,
}: {
  data: ReturnType<typeof useNavPrototypeData>;
}) {
  const { areas, threads, currentArea, currentThread } = data;
  if (!currentArea) return null;

  const openThreadsInArea = (threads ?? []).filter(
    (t) => t.areaId === currentArea._id && t.state === "open",
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-4 pt-3 text-sm"
    >
      <Link
        to="/"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        Dashboard
      </Link>
      <ChevronRight className="size-3.5 text-muted-foreground/60" />

      {/* Area segment: dropdown of all areas for one-hop lateral moves */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted",
                currentThread ? "text-muted-foreground" : "font-medium",
              )}
            />
          }
        >
          <AreaIcon icon={currentArea.icon} className="size-3.5" />
          {currentArea.name}
          <ChevronDown className="size-3 text-muted-foreground/60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(areas ?? []).map((area) => (
            <DropdownMenuItem
              key={area._id}
              render={
                <Link
                  to="/$areaSlug"
                  params={{ areaSlug: area.slug ?? area._id }}
                />
              }
            >
              <AreaIcon icon={area.icon} className="size-4" />
              {area.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {currentThread && (
        <>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium transition-colors hover:bg-muted"
                />
              }
            >
              <span className="max-w-56 truncate">{currentThread.title}</span>
              <ChevronDown className="size-3 shrink-0 text-muted-foreground/60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {openThreadsInArea.map((thread) => (
                <DropdownMenuItem
                  key={thread._id}
                  render={
                    <Link
                      to="/$areaSlug/$threadSlug"
                      params={{
                        areaSlug: currentArea.slug ?? currentArea._id,
                        threadSlug: thread.slug ?? thread._id,
                      }}
                    />
                  }
                >
                  <span className="max-w-64 truncate">{thread.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </nav>
  );
}
