import { Link, useLocation } from "@tanstack/react-router";
import { Inbox, LayoutDashboard, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";

interface MobileTabBarProps {
  noteCount: number | undefined;
  inboxOpen: boolean;
  onToggleInbox: () => void;
  onNewNote: () => void;
  onOpenPalette: () => void;
}

export function MobileTabBar({
  noteCount,
  inboxOpen,
  onToggleInbox,
  onNewNote,
  onOpenPalette,
}: MobileTabBarProps) {
  const { pathname } = useLocation();

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
      <button
        type="button"
        aria-expanded={inboxOpen}
        onClick={onToggleInbox}
        className={tabClassName(inboxOpen)}
      >
        <span className="relative">
          <Inbox className="size-5" />
          {noteCount !== undefined && noteCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs leading-none font-semibold text-primary-foreground">
              {noteCount}
            </span>
          )}
        </span>
        Notes
      </button>
      <button type="button" onClick={onNewNote} className={tabClassName(false)}>
        <Plus className="size-5" />
        New note
      </button>
    </nav>
  );
}
