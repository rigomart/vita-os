import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectTimeline } from "@/components/projects/project-timeline";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useProjectMutations } from "@/hooks/use-project-mutations";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const { createProject } = useProjectMutations();
  const [showCreate, setShowCreate] = useState(false);
  const isLoading = projects === undefined;

  if (isLoading) {
    return <ProjectsListSkeleton />;
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Projects"
          actions={
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4" />
              New project
            </Button>
          }
        />
      </div>

      <ProjectTimeline projects={projects} />

      <div className="mx-auto mt-6 max-w-3xl">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No projects yet. Create one to organize your tasks.
            </p>
          </div>
        ) : (
          <div>
            {projects.map((project) => (
              <div key={project._id}>
                <Link
                  to="/projects/$projectSlug"
                  params={{
                    projectSlug: project.slug ?? project._id,
                  }}
                  className="-mx-2 flex items-center gap-3 rounded px-2 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{project.name}</span>
                    {project.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {project.startDate && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(project.startDate), "MMM d")}
                      {project.endDate &&
                        ` – ${format(new Date(project.endDate), "MMM d")}`}
                    </span>
                  )}
                </Link>
                <Separator />
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={(data) => createProject(data)}
      />
    </div>
  );
}

function ProjectsListSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
        <div key={i}>
          <div className="py-3">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-1.5 h-3 w-64 animate-pulse rounded bg-muted" />
          </div>
          <Separator />
        </div>
      ))}
    </div>
  );
}
