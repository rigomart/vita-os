import { api } from "@convex/_generated/api";
import { healthColors } from "@convex/lib/healthStatus";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Badge } from "@vita-os/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  SidebarRail,
} from "@vita-os/ui/components/sidebar";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  CheckCircle2,
  ChevronRight,
  ChevronsUpDown,
  CirclePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plus,
} from "lucide-react";
import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { NewItemDialog } from "@/features/items/new-item/new-item-dialog";
import { useCreateItem } from "@/features/items/use-create-item";
import { CreateProjectDialog } from "@/features/projects/project-form/create-project-dialog";
import { useGlobalNewItemShortcut } from "@/features/sidebar/use-global-new-item-shortcut";
import { useSidebarDialogs } from "@/features/sidebar/use-sidebar-dialogs";
import { useAreaProjectTree } from "@/hooks/use-area-project-tree";
import { authClient } from "@/lib/auth-client";

export function AppSidebar() {
  const { data: session } = authClient.useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { areas, areaProjects } = useAreaProjectTree();
  const itemCount = useQuery(api.items.count);
  const {
    showCreateProject,
    setShowCreateProject,
    createForAreaId,
    showNewItem,
    setShowNewItem,
    openNewItem,
    showCreateArea,
    setShowCreateArea,
    openCreateProject,
  } = useSidebarDialogs();
  const createItem = useCreateItem();

  useGlobalNewItemShortcut(openNewItem);

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
                  onClick={openNewItem}
                  className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <CirclePlus className="size-4" />
                  <span>New item</span>
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
                  {itemCount !== undefined && itemCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px] tabular-nums"
                    >
                      {itemCount}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/completed"}
                  tooltip="Completed"
                  render={<Link to="/completed" />}
                >
                  <CheckCircle2 />
                  <span>Completed</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Areas</SidebarGroupLabel>
            <SidebarMenu>
              {areas?.map((area) => {
                const areaSlug = area.slug ?? area._id;
                const areaProjectList = areaProjects.get(area._id) ?? [];
                const hasProjects = areaProjectList.length > 0;
                return (
                  <Collapsible
                    key={area._id}
                    defaultOpen
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        tooltip={area.name}
                        isActive={pathname === `/${areaSlug}`}
                        render={<Link to="/$areaSlug" params={{ areaSlug }} />}
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${healthColors[area.healthStatus]}`}
                        />
                        <span>{area.name}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        className="right-6"
                        onClick={() => openCreateProject(area._id)}
                      >
                        <Plus />
                        <span className="sr-only">New project</span>
                      </SidebarMenuAction>
                      {hasProjects && (
                        <CollapsibleTrigger
                          render={
                            <SidebarMenuAction className="data-[state=open]:rotate-90" />
                          }
                        >
                          <ChevronRight />
                          <span className="sr-only">Toggle</span>
                        </CollapsibleTrigger>
                      )}
                      {hasProjects && (
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {areaProjectList.map((project) => {
                              const slug = project.slug ?? project._id;
                              return (
                                <SidebarMenuSubItem key={project._id}>
                                  <SidebarMenuSubButton
                                    isActive={
                                      pathname === `/${areaSlug}/${slug}`
                                    }
                                    render={
                                      <Link
                                        to="/$areaSlug/$projectSlug"
                                        params={{
                                          areaSlug,
                                          projectSlug: slug,
                                        }}
                                      />
                                    }
                                  >
                                    <span className="truncate">
                                      {project.name}
                                    </span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>
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
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        areas={areas ?? []}
        defaultAreaId={createForAreaId}
        onCreated={({ slug, areaId }) => {
          const area = (areas ?? []).find((a) => a._id === areaId);
          if (area) {
            navigate({
              to: "/$areaSlug/$projectSlug",
              params: {
                areaSlug: area.slug ?? area._id,
                projectSlug: slug,
              },
            });
          }
        }}
      />
      <NewItemDialog
        open={showNewItem}
        onOpenChange={setShowNewItem}
        onSubmit={async (value) => {
          await createItem(value);
          setShowNewItem(false);
        }}
      />
      <CreateAreaDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
      />
    </>
  );
}
