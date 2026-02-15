import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const id = projectId as Id<"projects">;
  const project = useQuery(api.projects.get, { id });
  const tasks = useQuery(api.tasks.listByProject, {
    projectId: id,
  });
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const navigate = useNavigate();
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
    await removeProject({ id });
    navigate({ to: "/projects" });
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/projects"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Projects
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-1">
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
          </div>
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
      </div>

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
          <TaskRow key={task._id} task={task} projectId={id} />
        ))}
        <AddTaskRow projectId={id} />
        {completedTasks.length > 0 && (
          <CompletedSection tasks={completedTasks} projectId={id} />
        )}
      </div>

      {project && (
        <ProjectFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          project={project}
          onSubmit={(data) =>
            updateProject({
              id,
              name: data.name,
              description: data.description,
              clearDescription: !data.description,
              definitionOfDone: data.definitionOfDone,
              clearDefinitionOfDone: !data.definitionOfDone,
            })
          }
        />
      )}
    </div>
  );
}
