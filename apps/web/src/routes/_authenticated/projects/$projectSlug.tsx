import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { generateSlug } from "@convex/lib/slugs";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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

export const Route = createFileRoute("/_authenticated/projects/$projectSlug")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectSlug } = Route.useParams();
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
    },
  );
  const [showEdit, setShowEdit] = useState(false);

  const isLoading = project === undefined || tasks === undefined;

  if (isLoading) {
    return <TaskListSkeleton />;
  }

  if (project === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link to="/projects" className="mt-2 inline-block text-sm underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  const handleDelete = async () => {
    await removeProject({ id: project._id });
    navigate({ to: "/projects" });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={project.name}
        backLink={{ label: "Projects", to: "/projects" }}
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
            if (data.name !== project.name && result?.slug) {
              navigate({
                to: "/projects/$projectSlug",
                params: { projectSlug: result.slug },
                replace: true,
              });
            }
          }}
        />
      )}
    </div>
  );
}
