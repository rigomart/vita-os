import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  ChevronRight,
  ChevronsUpDown,
  Inbox,
  LogOut,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { Button } from "../ui/button";

export function AppSidebar() {
  const { data: session } = authClient.useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list);
  const areas = useQuery(api.areas.list);
  const createProject = useMutation(api.projects.create).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.projects.list, {});
      if (current !== undefined) {
        const maxOrder = current.reduce((max, p) => Math.max(max, p.order), -1);
        localStore.setQuery(api.projects.list, {}, [
          ...current,
          {
            _id: crypto.randomUUID() as Id<"projects">,
            _creationTime: Date.now(),
            userId: "",
            name: args.name,
            slug: generateSlug(args.name),
            description: args.description,
            definitionOfDone: args.definitionOfDone,
            areaId: args.areaId,
            startDate: args.startDate,
            endDate: args.endDate,
            order: maxOrder + 1,
            isArchived: false,
            createdAt: Date.now(),
          },
        ]);
      }
    },
  );
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createForAreaId, setCreateForAreaId] = useState<string | undefined>();

  const { areaProjects, ungroupedProjects } = useMemo(() => {
    const grouped = new Map<string, typeof projects>();
    const ungrouped: NonNullable<typeof projects> = [];
    for (const project of projects ?? []) {
      if (project.areaId) {
        const list = grouped.get(project.areaId) ?? [];
        list.push(project);
        grouped.set(project.areaId, list);
      } else {
        ungrouped.push(project);
      }
    }
    return {
      areaProjects: grouped,
      ungroupedProjects: ungrouped,
    };
  }, [projects]);

  const handleCreateProject = (forAreaId?: string) => {
    setCreateForAreaId(forAreaId);
    setShowCreateProject(true);
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg font-semibold">
                    V
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-medium">vita-os</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/"}
                  tooltip="Inbox"
                >
                  <Link to="/">
                    <Inbox />
                    <span>Inbox</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {areas?.map((area) => {
                const areaSlug = area.slug ?? area._id;
                const areaProjectList = areaProjects.get(area._id) ?? [];
                return (
                  <Collapsible
                    key={area._id}
                    defaultOpen
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton>
                          <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          {area.name}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <SidebarMenuAction
                        showOnHover
                        onClick={() => handleCreateProject(area._id)}
                        title="New project"
                        asChild
                      >
                        <Button size="icon-xs" variant="ghost">
                          <Plus />
                        </Button>
                      </SidebarMenuAction>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {areaProjectList.map((project) => {
                            const slug = project.slug ?? project._id;
                            return (
                              <SidebarMenuSubItem key={project._id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === `/${areaSlug}/${slug}`}
                                >
                                  <Link
                                    to="/$areaSlug/$projectSlug"
                                    params={{
                                      areaSlug,
                                      projectSlug: slug,
                                    }}
                                  >
                                    <span className="truncate">
                                      {project.name}
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}

              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      Ungrouped
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <SidebarMenuAction
                    showOnHover
                    onClick={() => handleCreateProject()}
                    title="New project"
                  >
                    <Plus />
                  </SidebarMenuAction>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {ungroupedProjects.map((project) => {
                        const slug = project.slug ?? project._id;
                        return (
                          <SidebarMenuSubItem key={project._id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === `/projects/${slug}`}
                            >
                              <Link
                                to="/projects/$projectSlug"
                                params={{
                                  projectSlug: slug,
                                }}
                              >
                                <span className="truncate">{project.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={
                      session?.user?.name ?? session?.user?.email ?? "Account"
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
                        {session?.user?.name ??
                          session?.user?.email ??
                          "Account"}
                      </span>
                      {session?.user?.name && (
                        <span className="truncate text-xs text-muted-foreground">
                          {session.user.email}
                        </span>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
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

      <ProjectFormDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        areas={areas ?? []}
        defaultAreaId={createForAreaId}
        onSubmit={async (data) => {
          const { slug } = await createProject({
            ...data,
            areaId: data.areaId ? (data.areaId as Id<"areas">) : undefined,
          });
          if (data.areaId) {
            const area = (areas ?? []).find((a) => a._id === data.areaId);
            if (area) {
              navigate({
                to: "/$areaSlug/$projectSlug",
                params: {
                  areaSlug: area.slug ?? area._id,
                  projectSlug: slug,
                },
              });
              return;
            }
          }
          navigate({
            to: "/projects/$projectSlug",
            params: { projectSlug: slug },
          });
        }}
      />
    </>
  );
}
