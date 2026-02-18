import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectTimeline } from "@/components/projects/project-timeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
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

  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.projects.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.projects.list,
          {},
          current.filter((p) => p._id !== args.id),
        );
      }
    },
  );
  const [showCreate, setShowCreate] = useState(false);
  const isLoading = projects === undefined;

  if (isLoading) {
    return <ProjectsListSkeleton />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Ungrouped"
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

      <ProjectTimeline projects={projects} />

      <div className="mt-6">
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
                <div className="group -mx-2 flex items-center rounded px-2 transition-colors hover:bg-muted/50">
                  <Link
                    to="/projects/$projectSlug"
                    params={{
                      projectSlug: project.slug ?? project._id,
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3"
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          All tasks in &ldquo;{project.name}
                          &rdquo; will be moved to Inbox.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            removeProject({
                              id: project._id,
                            })
                          }
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <Separator />
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        areas={areas ?? []}
        onSubmit={(data) =>
          createProject({
            ...data,
            areaId: data.areaId ? (data.areaId as Id<"areas">) : undefined,
          })
        }
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
