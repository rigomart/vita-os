import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { Kbd } from "@vita-os/ui/components/kbd";
import { Inbox, Plus, Search } from "lucide-react";

import { useTheme } from "@/features/theme/theme-provider";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { InboxTaskCountBadge } from "./inbox-task-count-badge";
import { UserMenu } from "./user-menu";

interface AppTopBarProps {
  taskCount: number | undefined;
  inboxActive: boolean;
  onNewTask: () => void;
  onOpenPalette: () => void;
}

export function AppTopBar({
  taskCount,
  inboxActive,
  onNewTask,
  onOpenPalette,
}: AppTopBarProps) {
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useTheme();

  return (
    // Below the thread detail rail (z-30): the desktop rail pushes the chrome
    // aside, but the mobile drawer (and the rail mid-animation) overlay it.
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="flex h-12 items-center gap-3 px-4">
        <Link
          to="/"
          aria-label="Vita OS home"
          className="flex min-w-0 items-center gap-2 rounded-lg ring-ring outline-none transition-opacity hover:opacity-80 focus-visible:ring-2"
        >
          <img
            src="/vita-logo.svg"
            alt=""
            className="size-7 shrink-0 rounded-lg shadow-sm ring-1 ring-border"
          />
          <span className="flex items-baseline gap-1 leading-none">
            <span className="font-heading text-base font-semibold tracking-tight">
              vita
            </span>
            <span className="text-[0.5625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              OS
            </span>
          </span>
        </Link>

        {/* On mobile the search affordance lives in the tab bar instead. */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="mx-auto hidden h-8 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Jump anywhere…</span>
          <Kbd className="ml-auto">⌘K</Kbd>
        </button>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            to="/inbox"
            aria-label="Inbox"
            className={cn(
              "relative hidden size-8 items-center justify-center rounded-md transition-colors md:flex",
              inboxActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Inbox className="size-4" />
            <span className="absolute -top-1 -right-1">
              <InboxTaskCountBadge taskCount={taskCount} />
            </span>
          </Link>
          <Button
            onClick={onNewTask}
            size="icon"
            aria-label="New task"
            className="hidden md:inline-flex"
          >
            <Plus />
          </Button>
          <UserMenu
            user={session?.user}
            theme={theme}
            onThemeChange={setTheme}
            onSignOut={() => authClient.signOut()}
          />
        </div>
      </div>
    </header>
  );
}
