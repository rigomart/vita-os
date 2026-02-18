import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  ChevronRight,
  ChevronsUpDown,
  Compass,
  FolderOpen,
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
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";

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
    return { areaProjects: grouped, ungroupedProjects: ungrouped };
  }, [projects]);

  const handleCreateProject = (forAreaId?: string) => {
    setCreateForAreaId(forAreaId);
    setShowCreateProject(true);
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <span className="font-semibold">vita-os</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
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
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {areas?.map((area) => {
            const areaSlug = area.slug ?? area._id;
            const areaProjectList = areaProjects.get(area._id) ?? [];
            return (
              <Collapsible
                key={area._id}
                defaultOpen
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel
                    asChild
                    className="hover:text-sidebar-foreground"
                  >
                    <Link to="/areas/$areaSlug" params={{ areaSlug }}>
                      <Compass className="mr-1 h-3 w-3" />
                      {area.name}
                    </Link>
                  </SidebarGroupLabel>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="New project"
                        onClick={() => handleCreateProject(area._id)}
                        className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-9 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 after:absolute after:-inset-2 md:after:hidden group-data-[collapsible=icon]:hidden [&>svg]:size-4 [&>svg]:shrink-0"
                      >
                        <Plus />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">New project</TooltipContent>
                  </Tooltip>
                  <CollapsibleTrigger asChild>
                    <SidebarGroupAction>
                      <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      <span className="sr-only">Toggle {area.name}</span>
                    </SidebarGroupAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {areaProjectList.map((project) => {
                          const slug = project.slug ?? project._id;
                          return (
                            <SidebarMenuItem key={project._id}>
                              <SidebarMenuButton
                                asChild
                                isActive={pathname === `/projects/${slug}`}
                                tooltip={project.name}
                              >
                                <Link
                                  to="/projects/$projectSlug"
                                  params={{
                                    projectSlug: slug,
                                  }}
                                >
                                  <FolderOpen />
                                  <span>{project.name}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}

          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="hover:text-sidebar-foreground"
              >
                <Link to="/projects">Ungrouped</Link>
              </SidebarGroupLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="New project"
                    onClick={() => handleCreateProject()}
                    className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-9 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 after:absolute after:-inset-2 md:after:hidden group-data-[collapsible=icon]:hidden [&>svg]:size-4 [&>svg]:shrink-0"
                  >
                    <Plus />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">New project</TooltipContent>
              </Tooltip>
              <CollapsibleTrigger asChild>
                <SidebarGroupAction>
                  <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  <span className="sr-only">Toggle ungrouped</span>
                </SidebarGroupAction>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {ungroupedProjects.map((project) => {
                      const slug = project.slug ?? project._id;
                      return (
                        <SidebarMenuItem key={project._id}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === `/projects/${slug}`}
                            tooltip={project.name}
                          >
                            <Link
                              to="/projects/$projectSlug"
                              params={{ projectSlug: slug }}
                            >
                              <FolderOpen />
                              <span>{project.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
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
          navigate({
            to: "/projects/$projectSlug",
            params: { projectSlug: slug },
          });
        }}
      />
    </>
  );
}
