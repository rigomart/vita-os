import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { AddTaskRow } from "@/components/tasks/add-task-row";
import { CompletedSection } from "@/components/tasks/completed-section";
import { TaskListSkeleton } from "@/components/tasks/task-list-skeleton";
import { TaskRow } from "@/components/tasks/task-row";
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
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/$areaSlug/$projectSlug")({
  component: AreaProjectDetailPage,
});

function AreaProjectDetailPage() {
  const { areaSlug, projectSlug } = Route.useParams();
  const area = useQuery(api.areas.getBySlug, { slug: areaSlug });
  const project = useQuery(api.projects.getBySlug, { slug: projectSlug });
  const tasks = useQuery(
    api.tasks.listByProject,
    project ? { projectId: project._id } : "skip",
  );
  const areas = useQuery(api.areas.list);
  const navigate = useNavigate();

  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      const { id, ...updates } = args;

      const resolved = { ...updates };
      if (updates.clearStartDate) {
        resolved.startDate = undefined;
        resolved.endDate = undefined;
      }
      if (updates.clearEndDate) {
        resolved.endDate = undefined;
      }
      if (updates.clearAreaId) {
        resolved.areaId = undefined;
      }

      const slugUpdate =
        updates.name !== undefined ? { slug: generateSlug(updates.name) } : {};
      const fullUpdates = { ...resolved, ...slugUpdate };

      const current = localStore.getQuery(api.projects.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.projects.list,
          {},
          current.map((p) => (p._id === id ? { ...p, ...fullUpdates } : p)),
        );
      }

      const single = localStore.getQuery(api.projects.get, { id });
      if (single !== undefined && single !== null) {
        localStore.setQuery(
          api.projects.get,
          { id },
          { ...single, ...fullUpdates },
        );
      }

      const bySlug = localStore.getQuery(api.projects.getBySlug, {
        slug: projectSlug,
      });
      if (bySlug !== undefined && bySlug !== null) {
        localStore.setQuery(
          api.projects.getBySlug,
          { slug: projectSlug },
          { ...bySlug, ...fullUpdates },
        );
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
      localStore.setQuery(api.projects.get, { id: args.id }, null);
      localStore.setQuery(api.projects.getBySlug, { slug: projectSlug }, null);
    },
  );
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    const title = project?.name
      ? `${project.name} | Vita OS`
      : "Project | Vita OS";
    document.title = title;
    return () => {
      document.title = "Vita OS";
    };
  }, [project?.name]);

  const isLoading =
    area === undefined || project === undefined || tasks === undefined;

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (area === null || project === null || project.areaId !== area._id) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link
          to="/$areaSlug"
          params={{ areaSlug }}
          className="mt-2 inline-block text-sm underline"
        >
          Back to area
        </Link>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  const handleDelete = async () => {
    await removeProject({ id: project._id });
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={project.name}
        backLink={{
          label: area.name,
          to: "/$areaSlug",
          params: { areaSlug },
        }}
        description={project.description || undefined}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEdit(true)}
              aria-label="Edit project"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete project">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All tasks in &ldquo;{project.name}&rdquo; will be moved to
                    Inbox.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      {(project.startDate || project.endDate) && (
        <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {project.startDate &&
              format(new Date(project.startDate), "MMM d, yyyy")}
            {project.startDate && project.endDate && " \u2013 "}
            {project.endDate &&
              format(new Date(project.endDate), "MMM d, yyyy")}
          </span>
        </div>
      )}

      {project.definitionOfDone && (
        <div className="mb-6 rounded-md border p-4">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Definition of Done
          </h2>
          <p className="whitespace-pre-wrap text-sm">
            {project.definitionOfDone}
          </p>
        </div>
      )}

      <Separator className="mb-4" />

      <div>
        {activeTasks.map((task) => (
          <TaskRow key={task._id} task={task} projectId={project._id} />
        ))}
        <AddTaskRow projectId={project._id} />
        {completedTasks.length > 0 && (
          <CompletedSection tasks={completedTasks} projectId={project._id} />
        )}
      </div>

      {project && (
        <ProjectFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          project={project}
          areas={areas ?? []}
          onSubmit={async (data) => {
            const result = await updateProject({
              id: project._id,
              name: data.name,
              description: data.description,
              clearDescription: !data.description,
              definitionOfDone: data.definitionOfDone,
              clearDefinitionOfDone: !data.definitionOfDone,
              areaId: data.areaId ? (data.areaId as Id<"areas">) : undefined,
              clearAreaId: !data.areaId,
              startDate: data.startDate,
              clearStartDate: !data.startDate,
              endDate: data.endDate,
              clearEndDate: !data.endDate,
            });

            const newSlug =
              data.name !== project.name && result?.slug
                ? result.slug
                : projectSlug;

            const areaChanged =
              (data.areaId ?? null) !== (project.areaId ?? null);

            if (areaChanged) {
              if (!data.areaId) {
                navigate({
                  to: "/projects/$projectSlug",
                  params: { projectSlug: newSlug },
                  replace: true,
                });
              } else {
                const newArea = (areas ?? []).find(
                  (a) => a._id === data.areaId,
                );
                if (newArea) {
                  navigate({
                    to: "/$areaSlug/$projectSlug",
                    params: {
                      areaSlug: newArea.slug ?? newArea._id,
                      projectSlug: newSlug,
                    },
                    replace: true,
                  });
                }
              }
            } else if (data.name !== project.name && result?.slug) {
              navigate({
                to: "/$areaSlug/$projectSlug",
                params: { areaSlug, projectSlug: result.slug },
                replace: true,
              });
            }
          }}
        />
      )}
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="mb-3 h-4 w-16" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1.5">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="mb-6 rounded-md border p-4">
        <Skeleton className="mb-2 h-3 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
      </div>

      <Separator className="mb-4" />

      <TaskListSkeleton />
    </div>
  );
}
