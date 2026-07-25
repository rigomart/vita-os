import { api } from "@convex/_generated/api";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
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
  SidebarSeparator,
} from "@vita-os/ui/components/sidebar";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { CirclePlus, Inbox, LayoutDashboard, Plus } from "lucide-react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { AreaIcon } from "@/features/areas/components/area-icon";
import { useGlobalNewTaskShortcut } from "@/features/sidebar/use-global-new-task-shortcut";
import { useSidebarDialogs } from "@/features/sidebar/use-sidebar-dialogs";
import { NewTaskDialog } from "@/features/tasks/new-task/new-task-dialog";
import { useCreateTask } from "@/features/tasks/use-create-task";
import { useTheme } from "@/features/theme/theme-provider";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";
import { useAreaThreadTree } from "@/hooks/use-area-thread-tree";
import { authClient } from "@/lib/auth-client";

import { InboxTaskCountBadge } from "./inbox-task-count-badge";
import { SidebarUserMenu } from "./sidebar-user-menu";

export function AppSidebar() {
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useTheme();
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
        <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:p-2">
          <Link
            to="/"
            aria-label="Vita OS home"
            className="flex min-w-0 items-center gap-3 rounded-2xl outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent focus-visible:ring-2 group-data-[collapsible=icon]:justify-center"
          >
            <img
              src="/vita-logo.svg"
              alt=""
              className="size-10 shrink-0 rounded-2xl shadow-sm ring-1 ring-sidebar-border group-data-[collapsible=icon]:size-8"
            />
            <span className="flex min-w-0 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
              <span className="flex items-baseline gap-1.5 leading-none">
                <span className="font-heading text-lg font-semibold tracking-tight">
                  vita
                </span>
                <span className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  OS
                </span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Life, in view
              </span>
            </span>
          </Link>
          <SidebarMenu>
            <SidebarMenuItem>
              <Button
                size="sm"
                onClick={openNewTask}
                className="w-full justify-start group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:px-0!"
              >
                <CirclePlus data-icon="inline-start" />
                <span className="group-data-[collapsible=icon]:hidden">
                  New task
                </span>
                <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">
                  Q
                </Kbd>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarSeparator className="mx-0" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
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
            theme={theme}
            onThemeChange={setTheme}
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
