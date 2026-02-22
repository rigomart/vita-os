import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { healthColors } from "@convex/lib/types";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  ChevronRight,
  ChevronsUpDown,
  CirclePlus,
  Inbox,
  LayoutDashboard,
  LogOut,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AreaFormDialog } from "@/components/areas/area-form-dialog";
import { QuickCaptureDialog } from "@/components/captures/quick-capture-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Kbd } from "@/components/ui/kbd";
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
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

export function AppSidebar() {
  const { data: session } = authClient.useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list);
  const areas = useQuery(api.areas.list);
  const captureCount = useQuery(api.captures.count);
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
            order: maxOrder + 1,
            state: "active" as const,
            createdAt: Date.now(),
          },
        ]);
      }
    },
  );
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createForAreaId, setCreateForAreaId] = useState<string | undefined>();
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showCreateArea, setShowCreateArea] = useState(false);
  const createArea = useMutation(api.areas.create).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.areas.list, {});
      if (current !== undefined) {
        const maxOrder = current.reduce((max, a) => Math.max(max, a.order), -1);
        localStore.setQuery(api.areas.list, {}, [
          ...current,
          {
            _id: crypto.randomUUID() as Id<"areas">,
            _creationTime: Date.now(),
            userId: "",
            name: args.name,
            slug: generateSlug(args.name),
            standard: args.standard,
            healthStatus: args.healthStatus,
            order: maxOrder + 1,
            createdAt: Date.now(),
          },
        ]);
      }
    },
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "q" && e.key !== "Q") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      setShowQuickCapture(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const areaProjects = useMemo(() => {
    const grouped = new Map<string, typeof projects>();
    for (const project of projects ?? []) {
      if (project.areaId) {
        const list = grouped.get(project.areaId) ?? [];
        list.push(project);
        grouped.set(project.areaId, list);
      }
    }
    return grouped;
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
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
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
                <button
                  type="button"
                  onClick={() => setShowQuickCapture(true)}
                  className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <CirclePlus className="size-4" />
                  <span>Capture</span>
                  <Kbd className="ml-auto bg-primary-foreground/15 text-primary-foreground/70">
                    Q
                  </Kbd>
                </button>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/"}
                  tooltip="Dashboard"
                >
                  <Link to="/">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/inbox"}
                  tooltip="Inbox"
                >
                  <Link to="/inbox">
                    <Inbox />
                    <span>Inbox</span>
                    {captureCount !== undefined && captureCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px] tabular-nums"
                      >
                        {captureCount}
                      </Badge>
                    )}
                  </Link>
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
                        asChild
                        tooltip={area.name}
                        isActive={pathname === `/${areaSlug}`}
                      >
                        <Link to="/$areaSlug" params={{ areaSlug }}>
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${healthColors[area.healthStatus]}`}
                          />
                          <span>{area.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        className="right-6"
                        onClick={() => handleCreateProject(area._id)}
                      >
                        <Plus />
                        <span className="sr-only">New project</span>
                      </SidebarMenuAction>
                      {hasProjects && (
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction className="data-[state=open]:rotate-90">
                            <ChevronRight />
                            <span className="sr-only">Toggle</span>
                          </SidebarMenuAction>
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
                                    asChild
                                    isActive={
                                      pathname === `/${areaSlug}/${slug}`
                                    }
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
            areaId: data.areaId as Id<"areas">,
          });
          const area = (areas ?? []).find((a) => a._id === data.areaId);
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
      <QuickCaptureDialog
        open={showQuickCapture}
        onOpenChange={setShowQuickCapture}
      />
      <AreaFormDialog
        open={showCreateArea}
        onOpenChange={setShowCreateArea}
        onSubmit={(data) => createArea(data)}
      />
    </>
  );
}
