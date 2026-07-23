import { api } from "@convex/_generated/api";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
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
import {
  ChevronsUpDown,
  CirclePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plus,
} from "lucide-react";

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
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      tooltip={
                        session?.user?.name ?? session?.user?.email ?? "Account"
                      }
                    />
                  }
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {(
                      session?.user?.name?.[0] ??
                      session?.user?.email?.[0] ??
                      "?"
                    ).toUpperCase()}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {session?.user?.name ?? session?.user?.email ?? "Account"}
                    </span>
                    {session?.user?.name && (
                      <span className="truncate text-xs text-muted-foreground">
                        {session.user.email}
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                  side="top"
                  align="start"
                  sideOffset={4}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-1">
                        {session?.user?.name && (
                          <p className="text-sm font-medium leading-none">
                            {session.user.name}
                          </p>
                        )}
                        <p className="text-xs leading-none text-muted-foreground">
                          {session?.user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => authClient.signOut()}>
                      <LogOut />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
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
