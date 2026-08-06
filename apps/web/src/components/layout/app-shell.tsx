import type { ReactNode } from "react";

import { api } from "@convex/_generated/api";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { useCommandPaletteShortcut } from "@/features/navigation/use-command-palette-shortcut";
import { useCreateDialogs } from "@/features/navigation/use-create-dialogs";
import { useGlobalNewTaskShortcut } from "@/features/navigation/use-global-new-task-shortcut";
import { NewTaskDialog } from "@/features/tasks/new-task/new-task-dialog";
import { useCreateTask } from "@/features/tasks/use-create-task";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";

import { AppTopBar } from "./app-top-bar";
import { CommandPalette } from "./command-palette";
import { MobileTabBar } from "./mobile-tab-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const areas = useQuery(api.areas.list);
  const threads = useQuery(api.threads.list);
  const taskCount = useQuery(api.tasks.count);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const dialogs = useCreateDialogs();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useGlobalNewTaskShortcut(dialogs.openNewTask);
  useCommandPaletteShortcut(() => setPaletteOpen(true));

  return (
    <div className="flex min-h-svh flex-col">
      <AppTopBar
        taskCount={taskCount}
        inboxActive={pathname === "/inbox"}
        onNewTask={dialogs.openNewTask}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <main className="w-full flex-1 px-4 pt-3 pb-24 md:pb-8">{children}</main>
      <MobileTabBar taskCount={taskCount} onNewTask={dialogs.openNewTask} />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        areas={areas}
        threads={threads}
        onNewTask={dialogs.openNewTask}
        onNewThread={() => dialogs.openCreateThread()}
        onNewArea={dialogs.openCreateArea}
      />

      <CreateThreadDialog
        open={dialogs.showCreateThread}
        onOpenChange={dialogs.setShowCreateThread}
        areas={areas ?? []}
        defaultAreaId={dialogs.createForAreaId}
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
        open={dialogs.showNewTask}
        onOpenChange={dialogs.setShowNewTask}
        onSubmit={async (value) => {
          await createTask(value);
          dialogs.setShowNewTask(false);
        }}
      />
      <CreateAreaDialog
        open={dialogs.showCreateArea}
        onOpenChange={dialogs.setShowCreateArea}
      />
    </div>
  );
}
