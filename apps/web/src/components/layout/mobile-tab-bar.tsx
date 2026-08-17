import { Link, useLocation } from "@tanstack/react-router";
import { Inbox, LayoutDashboard, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";

// PROTOTYPE (issue #291): remove — summon instead of navigate.
import { useInboxPrototype } from "./prototype/inbox-prototype-context";

interface MobileTabBarProps {
  taskCount: number | undefined;
  onNewTask: () => void;
  onOpenPalette: () => void;
}

export function MobileTabBar({
  taskCount,
  onNewTask,
  onOpenPalette,
}: MobileTabBarProps) {
  const { pathname } = useLocation();
  // PROTOTYPE (issue #291): remove — summons the mobile drawer form.
  const inboxPrototype = useInboxPrototype();

  const tabClassName = (active: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 text-2xs font-medium",
      active ? "text-foreground" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-4 border-t bg-background/95 backdrop-blur md:hidden"
    >
      <Link to="/" className={tabClassName(pathname === "/")}>
        <LayoutDashboard className="size-5" />
        Dashboard
      </Link>
      <button
        type="button"
        onClick={onOpenPalette}
        className={tabClassName(false)}
      >
        <Search className="size-5" />
        Search
      </button>
      {/* PROTOTYPE (issue #291): remove — button form when summoning. */}
      {inboxPrototype.summons ? (
        <button
          type="button"
          onClick={inboxPrototype.toggle}
          className={tabClassName(inboxPrototype.isOpen)}
        >
          <span className="relative">
            <Inbox className="size-5" />
            {taskCount !== undefined && taskCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs leading-none font-semibold text-primary-foreground">
                {taskCount}
              </span>
            )}
          </span>
          Inbox
        </button>
      ) : (
        <Link to="/inbox" className={tabClassName(pathname === "/inbox")}>
          <span className="relative">
            <Inbox className="size-5" />
            {taskCount !== undefined && taskCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs leading-none font-semibold text-primary-foreground">
                {taskCount}
              </span>
            )}
          </span>
          Inbox
        </Link>
      )}
      <button type="button" onClick={onNewTask} className={tabClassName(false)}>
        <Plus className="size-5" />
        New task
      </button>
    </nav>
  );
}
