import { api } from "@convex/_generated/api";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { FolderOpen, Inbox, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
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
import { authClient } from "@/lib/auth-client";

export function AppSidebar() {
  const { data: session } = authClient.useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const [showCreateProject, setShowCreateProject] = useState(false);

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

          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupAction
              title="New project"
              onClick={() => setShowCreateProject(true)}
            >
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects?.map((project) => {
                  return (
                    <SidebarMenuItem key={project._id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === `/projects/${project._id}`}
                        tooltip={project.name}
                      >
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: project._id }}
                        >
                          <FolderOpen />
                          <span>{project.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/projects"}
                    tooltip="All projects"
                  >
                    <Link to="/projects">
                      <FolderOpen />
                      <span>All projects</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sign out"
                onClick={() => authClient.signOut()}
              >
                <LogOut />
                <span className="truncate text-xs text-muted-foreground">
                  {session?.user?.email ?? "Sign out"}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <ProjectFormDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSubmit={async (data) => {
          const projectId = await createProject(data);
          navigate({ to: "/projects/$projectId", params: { projectId } });
        }}
      />
    </>
  );
}
