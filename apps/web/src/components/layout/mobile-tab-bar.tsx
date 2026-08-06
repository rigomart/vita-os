import { Link, useLocation } from "@tanstack/react-router";
import { Inbox, LayoutDashboard, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface MobileTabBarProps {
  taskCount: number | undefined;
  onNewTask: () => void;
}

export function MobileTabBar({ taskCount, onNewTask }: MobileTabBarProps) {
  const { pathname } = useLocation();

  const tabClassName = (active: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium",
      active ? "text-foreground" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-3 border-t bg-background/95 backdrop-blur md:hidden"
    >
      <Link to="/" className={tabClassName(pathname === "/")}>
        <LayoutDashboard className="size-5" />
        Dashboard
      </Link>
      <Link to="/inbox" className={tabClassName(pathname === "/inbox")}>
        <span className="relative">
          <Inbox className="size-5" />
          {taskCount !== undefined && taskCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground">
              {taskCount}
            </span>
          )}
        </span>
        Inbox
      </Link>
      <button type="button" onClick={onNewTask} className={tabClassName(false)}>
        <Plus className="size-5" />
        New task
      </button>
    </nav>
  );
}
