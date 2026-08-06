// PROTOTYPE (issue #247) — THROWAWAY CODE, do not ship.
// Variant B — direction 2: slim sidebar. Chrome plus top-level Areas only
// (icon, condition dot, open-thread count) — no thread sub-tree. On mobile
// (direction 3): bottom tab bar with Dashboard / Inbox / New task.

import type { Condition } from "@convex/lib/condition";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vita-os/ui/components/tooltip";
import { Inbox, LayoutDashboard, Plus } from "lucide-react";
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
  MobileBottomTabs,
  NavPrototypeDialogs,
  NavPrototypeLogo,
  NavPrototypeUserMenu,
  useNavPrototypeData,
} from "./nav-prototype-shared";

const conditionDotClassName: Record<Condition, string> = {
  healthy: "bg-condition-healthy",
  needs_attention: "bg-condition-attention",
  critical: "bg-condition-critical",
};

export function NavVariantSlimRail({ children }: { children: ReactNode }) {
  const data = useNavPrototypeData();
  const dialogs = useSidebarDialogs();
  useGlobalNewTaskShortcut(dialogs.openNewTask);
  const [paletteOpen, setPaletteOpen] = useState(false);
  usePaletteShortcut(() => setPaletteOpen(true));

  const { areas, taskCount, openThreadCounts, pathname, currentArea } = data;

  return (
    <TooltipProvider delay={200}>
      <div className="flex min-h-svh">
        <aside
          aria-label="Primary"
          className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center gap-1 border-r bg-sidebar px-2 py-3 md:flex"
        >
          <Link
            to="/"
            aria-label="Vita OS home"
            className="mb-1 rounded-xl transition-opacity hover:opacity-80"
          >
            <img
              src="/vita-logo.svg"
              alt=""
              className="size-9 rounded-xl shadow-sm ring-1 ring-sidebar-border"
            />
          </Link>

          <RailButton
            label="Dashboard"
            active={pathname === "/"}
            render={<Link to="/" />}
          >
            <LayoutDashboard className="size-5" />
          </RailButton>
          <RailButton
            label={`Inbox${taskCount ? ` (${taskCount})` : ""}`}
            active={pathname === "/inbox"}
            render={<Link to="/inbox" />}
          >
            <Inbox className="size-5" />
            {taskCount !== undefined && taskCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground">
                {taskCount}
              </span>
            )}
          </RailButton>

          <div className="my-2 h-px w-8 bg-sidebar-border" />

          {(areas ?? []).map((area) => {
            const openCount = openThreadCounts.get(area._id) ?? 0;
            return (
              <RailButton
                key={area._id}
                label={`${area.name}${openCount ? ` — ${openCount} open` : ""}`}
                active={currentArea?._id === area._id}
                render={
                  <Link
                    to="/$areaSlug"
                    params={{ areaSlug: area.slug ?? area._id }}
                  />
                }
              >
                <AreaIcon icon={area.icon} className="size-5" />
                <span
                  className={cn(
                    "absolute right-0.5 bottom-0.5 size-2 rounded-full ring-2 ring-sidebar",
                    conditionDotClassName[area.condition],
                  )}
                />
                {openCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-muted-foreground/80 px-1 text-[0.625rem] font-semibold text-background">
                    {openCount}
                  </span>
                )}
              </RailButton>
            );
          })}

          <RailButton
            label="Add area"
            active={false}
            onClick={() => dialogs.setShowCreateArea(true)}
            muted
          >
            <Plus className="size-4" />
          </RailButton>

          <div className="mt-auto flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="New task"
                    onClick={dialogs.openNewTask}
                    className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                  />
                }
              >
                <Plus className="size-5" />
              </TooltipTrigger>
              <TooltipContent side="right">New task — Q</TooltipContent>
            </Tooltip>
            <NavPrototypeUserMenu align="start" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:pl-16">
          {/* Mobile-only slim top bar: brand + account. Nav lives in the bottom tabs. */}
          <header className="flex h-12 items-center justify-between border-b px-4 md:hidden">
            <NavPrototypeLogo />
            <NavPrototypeUserMenu />
          </header>
          <main className="w-full flex-1 px-4 pt-3 pb-24 md:pb-8">
            {children}
          </main>
        </div>

        <MobileBottomTabs
          taskCount={taskCount}
          onNewTask={dialogs.openNewTask}
        />
        <NavPrototypeDialogs controller={dialogs} areas={areas} />
        <NavPrototypePalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          data={data}
          dialogs={dialogs}
        />
      </div>
    </TooltipProvider>
  );
}

function RailButton({
  label,
  active,
  muted = false,
  render,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  muted?: boolean;
  render?: React.ReactElement;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = cn(
    "relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent/60",
    muted && "text-muted-foreground",
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={render ?? <button type="button" onClick={onClick} />}
        aria-label={label}
        className={className}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
