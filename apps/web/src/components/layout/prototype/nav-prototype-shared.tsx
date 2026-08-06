// PROTOTYPE (issue #247) — THROWAWAY CODE, do not ship.
// Shared plumbing for the nav-chrome variants: data, rehomed create dialogs,
// a non-sidebar user menu, and the mobile bottom tab bar (direction 3).

import type { Id } from "@convex/_generated/dataModel";
import type { ReactNode } from "react";

import { api } from "@convex/_generated/api";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  Inbox,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Sun,
} from "lucide-react";
import { useMemo } from "react";

import type { ThemePreference } from "@/features/theme/theme-provider";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { useSidebarDialogs } from "@/features/sidebar/use-sidebar-dialogs";
import { NewTaskDialog } from "@/features/tasks/new-task/new-task-dialog";
import { useCreateTask } from "@/features/tasks/use-create-task";
import { useTheme } from "@/features/theme/theme-provider";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";
import { useAreaThreadTree } from "@/hooks/use-area-thread-tree";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { InboxTaskCountBadge } from "../inbox-task-count-badge";

export function useNavPrototypeData() {
  const { areas, threads, areaThreads } = useAreaThreadTree();
  const taskCount = useQuery(api.tasks.count);
  const { pathname } = useLocation();

  const openThreadCounts = useMemo(() => {
    const counts = new Map<Id<"areas">, number>();
    for (const thread of threads ?? []) {
      if (thread.state === "open") {
        counts.set(thread.areaId, (counts.get(thread.areaId) ?? 0) + 1);
      }
    }
    return counts;
  }, [threads]);

  // Resolve the current Area/Thread from the pathname (routes are /$areaSlug
  // and /$areaSlug/$threadSlug; "inbox" is the only non-area top segment).
  const { currentArea, currentThread } = useMemo(() => {
    const segments = pathname
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    if (segments.length === 0 || segments[0] === "inbox") {
      return { currentArea: undefined, currentThread: undefined };
    }
    const area = areas?.find((a) => (a.slug ?? a._id) === segments[0]);
    const thread =
      area && segments[1]
        ? threads?.find(
            (t) => t.areaId === area._id && (t.slug ?? t._id) === segments[1],
          )
        : undefined;
    return { currentArea: area, currentThread: thread };
  }, [pathname, areas, threads]);

  return {
    areas,
    threads,
    areaThreads,
    taskCount,
    openThreadCounts,
    pathname,
    currentArea,
    currentThread,
  };
}

export type NavPrototypeData = ReturnType<typeof useNavPrototypeData>;
export type NavPrototypeDialogsController = ReturnType<
  typeof useSidebarDialogs
>;

/** The create dialogs the sidebar currently hosts, rehomed for sidebar-less chrome. */
export function NavPrototypeDialogs({
  controller,
  areas,
}: {
  controller: NavPrototypeDialogsController;
  areas: NavPrototypeData["areas"];
}) {
  const navigate = useNavigate();
  const createTask = useCreateTask();

  return (
    <>
      <CreateThreadDialog
        open={controller.showCreateThread}
        onOpenChange={controller.setShowCreateThread}
        areas={areas ?? []}
        defaultAreaId={controller.createForAreaId}
        onCreated={({ slug, areaId }) => {
          const area = (areas ?? []).find((a) => a._id === areaId);
          if (area) {
            navigate({
              to: "/$areaSlug/$threadSlug",
              params: { areaSlug: area.slug ?? area._id, threadSlug: slug },
            });
          }
        }}
      />
      <NewTaskDialog
        open={controller.showNewTask}
        onOpenChange={controller.setShowNewTask}
        onSubmit={async (value) => {
          await createTask(value);
          controller.setShowNewTask(false);
        }}
      />
      <CreateAreaDialog
        open={controller.showCreateArea}
        onOpenChange={controller.setShowCreateArea}
      />
    </>
  );
}

const themeOptions = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] satisfies readonly {
  value: ThemePreference;
  label: string;
  icon: typeof Monitor;
}[];

/** Avatar dropdown with theme + sign out — the sidebar footer menu, rehomed. */
export function NavPrototypeUserMenu({
  align = "end",
}: {
  align?: "start" | "center" | "end";
}) {
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useTheme();
  const user = session?.user;
  const accountName = user?.name ?? user?.email ?? "Account";
  const initial = (user?.name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
          />
        }
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuLabel className="truncate">
          {accountName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as ThemePreference)}
        >
          {themeOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => authClient.signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Direction 3: Dashboard / Inbox / New task bottom tabs, mobile only. */
export function MobileBottomTabs({
  taskCount,
  onNewTask,
}: {
  taskCount: number | undefined;
  onNewTask: () => void;
}) {
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

/** Small logo link shared by the variant headers. */
export function NavPrototypeLogo({
  withWordmark = true,
}: {
  withWordmark?: boolean;
}) {
  return (
    <Link
      to="/"
      aria-label="Vita OS home"
      className="flex min-w-0 items-center gap-2 rounded-lg outline-none ring-ring transition-opacity hover:opacity-80 focus-visible:ring-2"
    >
      <img
        src="/vita-logo.svg"
        alt=""
        className="size-7 shrink-0 rounded-lg shadow-sm ring-1 ring-border"
      />
      {withWordmark && (
        <span className="flex items-baseline gap-1 leading-none">
          <span className="font-heading text-base font-semibold tracking-tight">
            vita
          </span>
          <span className="text-[0.5625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            OS
          </span>
        </span>
      )}
    </Link>
  );
}

export function NewTaskButton({
  onClick,
  iconOnly = false,
}: {
  onClick: () => void;
  iconOnly?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      size={iconOnly ? "icon" : "default"}
      aria-label="New task"
    >
      <Plus data-icon="inline-start" />
      {!iconOnly && <span>New task</span>}
    </Button>
  );
}

export { InboxTaskCountBadge };
export type { ReactNode };
