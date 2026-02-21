import type { Doc, Id } from "@convex/_generated/dataModel";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { DueDateLabel } from "@/components/tasks/due-date-label";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useTaskMutations } from "@/hooks/use-task-mutations";

export function TaskRow({
  task,
  projectId,
}: {
  task: Doc<"tasks">;
  projectId?: Id<"projects">;
}) {
  const { updateTask, removeTask } = useTaskMutations(projectId);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="group flex items-start gap-3 py-3">
      <Checkbox
        checked={task.isCompleted}
        onCheckedChange={(checked) =>
          updateTask({
            id: task._id,
            isCompleted: checked === true,
          })
        }
        className="mt-0.5 rounded-full"
      />
      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={() => setEditOpen(true)}
      >
        <span
          className={
            task.isCompleted ? "line-through text-muted-foreground" : ""
          }
        >
          {task.title}
        </span>
        {task.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {task.description}
          </p>
        )}
        {task.dueDate && <DueDateLabel timestamp={task.dueDate} />}
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Delete task"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{task.title}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTask({ id: task._id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EditTaskDialog
        task={task}
        projectId={projectId}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
