import { api } from "@convex/_generated/api";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Kbd } from "@vita-os/ui/components/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@vita-os/ui/components/sidebar";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { CirclePlus, Inbox, LayoutDashboard, Plus } from "lucide-react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { AreaIcon } from "@/features/areas/components/area-icon";
import { useGlobalNewTaskShortcut } from "@/features/sidebar/use-global-new-task-shortcut";
import { useSidebarDialogs } from "@/features/sidebar/use-sidebar-dialogs";
import { NewTaskDialog } from "@/features/tasks/new-task/new-task-dialog";
import { useCreateTask } from "@/features/tasks/use-create-task";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";
import { useAreaThreadTree } from "@/hooks/use-area-thread-tree";
import { authClient } from "@/lib/auth-client";

import { InboxTaskCountBadge } from "./inbox-task-count-badge";
import { SidebarUserMenu } from "./sidebar-user-menu";

export function AppSidebar() {
  const { data: session } = authClient.useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { areas, areaThreads } = useAreaThreadTree();
  const taskCount = useQuery(api.tasks.count);
  const {
    showCreateThread,
    setShowCreateThread,
    createForAreaId,
    showNewTask,
    setShowNewTask,
    openNewTask,
    showCreateArea,
    setShowCreateArea,
    openCreateThread,
  } = useSidebarDialogs();
  const createTask = useCreateTask();

  useGlobalNewTaskShortcut(openNewTask);

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link to="/" />}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
                  V
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">vita-os</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <button
                  type="button"
                  onClick={openNewTask}
                  className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <CirclePlus className="size-4" />
                  <span>New task</span>
                  <Kbd className="ml-auto bg-primary-foreground/15 text-primary-foreground/70">
                    Q
                  </Kbd>
                </button>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/"}
                  tooltip="Dashboard"
                  render={<Link to="/" />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/inbox"}
                  tooltip="Inbox"
                  render={<Link to="/inbox" />}
                >
                  <Inbox />
                  <span>Inbox</span>
                  <InboxTaskCountBadge taskCount={taskCount} />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Areas</SidebarGroupLabel>
            <SidebarMenu>
              {areas?.map((area) => {
                const areaSlug = area.slug ?? area._id;
                const areaThreadList = areaThreads.get(area._id) ?? [];
                return (
                  <SidebarMenuItem key={area._id}>
                    <SidebarMenuButton
                      tooltip={area.name}
                      isActive={pathname === `/${areaSlug}`}
                      render={<Link to="/$areaSlug" params={{ areaSlug }} />}
                    >
                      <AreaIcon icon={area.icon} className="size-4" />
                      <span>{area.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      className="right-2"
                      onClick={() => openCreateThread(area._id)}
                    >
                      <Plus />
                      <span className="sr-only">New thread</span>
                    </SidebarMenuAction>
                    {areaThreadList.length > 0 && (
                      <SidebarMenuSub>
                        {areaThreadList.map((thread) => {
                          const slug = thread.slug ?? thread._id;
                          return (
                            <SidebarMenuSubItem key={thread._id}>
                              <SidebarMenuSubButton
                                isActive={pathname === `/${areaSlug}/${slug}`}
                                render={
                                  <Link
                                    to="/$areaSlug/$threadSlug"
                                    params={{
                                      areaSlug,
                                      threadSlug: slug,
                                    }}
                                  />
                                }
                              >
                                <span className="truncate">{thread.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="text-muted-foreground"
                  onClick={() => setShowCreateArea(true)}
                >
                  <Plus />
                  <span>Add area</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarUserMenu
            user={session?.user}
            onSignOut={() => authClient.signOut()}
          />
        </SidebarFooter>
      </Sidebar>

      <CreateThreadDialog
        open={showCreateThread}
        onOpenChange={setShowCreateThread}
        areas={areas ?? []}
        defaultAreaId={createForAreaId}
        onCreated={({ slug, areaId }) => {
          const area = (areas ?? []).find((a) => a._id === areaId);
          if (area) {
            navigate({
              to: "/$areaSlug/$threadSlug",
              params: {
                areaSlug: area.slug ?? area._id,
                threadSlug: slug,
              },
            });
          }
        }}
      />
      <NewTaskDialog
        open={showNewTask}
        onOpenChange={setShowNewTask}
        onSubmit={async (value) => {
          await createTask(value);
          setShowNewTask(false);
        }}
      />
      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </>
  );
}
