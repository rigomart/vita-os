import type { ReactNode } from "react";

import { api } from "@convex/_generated/api";
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { AreaIconRail } from "@/components/dev/area-switcher-prototype/area-icon-rail";
import { TopBarAreaStrip } from "@/components/dev/area-switcher-prototype/top-bar-area-strip";
import {
  AREA_SWITCHER_VARIANTS,
  useAreaSwitcherVariant,
} from "@/components/dev/area-switcher-prototype/use-area-switcher-variant";
import {
  PrototypeVariantSelector,
  type PrototypeVariant,
} from "@/components/dev/prototype-variants";
import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { useCommandPaletteShortcut } from "@/features/navigation/use-command-palette-shortcut";
import { useCreateDialogs } from "@/features/navigation/use-create-dialogs";
import { useGlobalNewTaskShortcut } from "@/features/navigation/use-global-new-task-shortcut";
import { NewTaskDialog } from "@/features/tasks/new-task/new-task-dialog";
import { useCreateTask } from "@/features/tasks/use-create-task";
import { ThreadDetailView } from "@/features/threads/thread-detail/thread-detail-view";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";

import { AppTopBar } from "./app-top-bar";
import { CommandPalette } from "./command-palette";
import { MobileTabBar } from "./mobile-tab-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const taskCount = useQuery(api.tasks.count);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const dialogs = useCreateDialogs();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // PROTOTYPE — area quick-switcher variants (throwaway).
  const { variant: switcherVariant, setVariant: setSwitcherVariant } =
    useAreaSwitcherVariant();

  // The area list is only read by the create-thread dialog here; the palette
  // subscribes for itself while it is mounted.
  const createThreadAreas = useQuery(
    api.areas.list,
    dialogs.showCreateThread ? {} : "skip",
  );

  useGlobalNewTaskShortcut(dialogs.openNewTask);
  useCommandPaletteShortcut(() => setPaletteOpen(true));

  // The thread pane opens from two sources: the global `?thread=<slug>`
  // search param (any page, in place) or the /$areaSlug/$threadSlug deep
  // link. When both are present, the search param wins.
  const { thread: searchThreadSlug } = useSearch({ from: "/_authenticated" });
  const threadRouteMatch = useMatch({
    from: "/_authenticated/$areaSlug/$threadSlug",
    shouldThrow: false,
  });
  const routeAreaSlug = threadRouteMatch?.params.areaSlug;
  const isSearchSource = searchThreadSlug !== undefined;
  const openThreadSlug =
    searchThreadSlug ?? threadRouteMatch?.params.threadSlug;

  const openThreadInPlace = (slug: string) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, thread: slug }),
    });
  };

  // Close must leave the thread route when one is matched underneath, even if
  // the pane was showing a search-param thread on top of it — stripping only
  // the param would let the route match reopen the pane with the stale thread.
  const closeThreadPane = () => {
    if (routeAreaSlug !== undefined) {
      navigate({
        to: "/$areaSlug",
        params: { areaSlug: routeAreaSlug },
        search: (prev) => ({ ...prev, thread: undefined }),
        replace: true,
      });
    } else {
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, thread: undefined }),
        replace: true,
      });
    }
  };

  const handleThreadLocationChange = ({
    areaSlug,
    threadSlug,
  }: {
    areaSlug: string;
    threadSlug: string;
  }) => {
    if (isSearchSource) {
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, thread: threadSlug }),
        replace: true,
      });
    } else {
      navigate({
        to: "/$areaSlug/$threadSlug",
        params: { areaSlug, threadSlug },
        replace: true,
      });
    }
  };

  return (
    <div className="flex min-h-svh">
      {switcherVariant === "B" && <AreaIconRail />}
      {/* The whole chrome column — topbar included — sits beside the thread
          rail's width spacer, so an open rail pushes the topbar too instead
          of sliding over it. */}
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <AppTopBar
          taskCount={taskCount}
          inboxActive={pathname === "/inbox"}
          onNewTask={dialogs.openNewTask}
          onOpenPalette={() => setPaletteOpen(true)}
          areaStrip={switcherVariant === "A" ? <TopBarAreaStrip /> : undefined}
        />
        <main className="w-full min-w-0 flex-1 px-4 pt-3 pb-24 md:pb-8">
          {children}
        </main>
        <MobileTabBar
          taskCount={taskCount}
          onNewTask={dialogs.openNewTask}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      </div>
      {openThreadSlug !== undefined && (
        <ThreadDetailView
          threadSlug={openThreadSlug}
          areaSlug={isSearchSource ? undefined : routeAreaSlug}
          onClose={closeThreadPane}
          onThreadLocationChange={handleThreadLocationChange}
        />
      )}

      {/* Mounted on demand: each surface holds form state and subscriptions
          that should not exist — or survive a close — while it is hidden. */}
      {paletteOpen && (
        <CommandPalette
          open
          onOpenChange={setPaletteOpen}
          onNewTask={dialogs.openNewTask}
          onNewThread={() => dialogs.openCreateThread()}
          onNewArea={dialogs.openCreateArea}
        />
      )}

      {/* Also held until the gated list resolves — never an empty picker. */}
      {dialogs.showCreateThread && createThreadAreas !== undefined && (
        <CreateThreadDialog
          open
          onOpenChange={dialogs.setShowCreateThread}
          areas={createThreadAreas}
          defaultAreaId={dialogs.createForAreaId}
          onCreated={({ slug }) => {
            openThreadInPlace(slug);
          }}
        />
      )}
      {dialogs.showNewTask && (
        <NewTaskDialog
          open
          onOpenChange={dialogs.setShowNewTask}
          onSubmit={async (value) => {
            await createTask(value);
            dialogs.setShowNewTask(false);
          }}
        />
      )}
      {dialogs.showCreateArea && (
        <CreateAreaDialog open onOpenChange={dialogs.setShowCreateArea} />
      )}

      {import.meta.env.DEV && (
        <PrototypeVariantSelector
          variants={
            AREA_SWITCHER_VARIANTS.map((v) => ({
              ...v,
              render: () => null,
            })) as unknown as readonly [PrototypeVariant, ...PrototypeVariant[]]
          }
          activeKey={switcherVariant}
          onSelect={setSwitcherVariant}
        />
      )}
    </div>
  );
}
