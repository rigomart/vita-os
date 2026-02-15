import type { Doc, Id } from "@convex/_generated/dataModel";
import { format, isToday, isTomorrow } from "date-fns";
import { Calendar as CalendarIcon, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { useTaskMutations } from "@/hooks/use-task-mutations";

export function TaskRow({
  task,
  projectId,
}: {
  task: Doc<"tasks">;
  projectId?: Id<"projects">;
}) {
  const { updateTask, removeTask } = useTaskMutations(projectId);

  return (
    <>
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
        <div className="min-w-0 flex-1">
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
        </div>
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
      </div>
      <Separator />
    </>
  );
}

function DueDateLabel({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  let label: string;
  let className = "text-xs text-muted-foreground";

  if (isToday(date)) {
    label = "Today";
    className = "text-xs text-green-600";
  } else if (isTomorrow(date)) {
    label = "Tomorrow";
    className = "text-xs text-orange-600";
  } else if (date < new Date()) {
    label = format(date, "MMM d");
    className = "text-xs text-red-600";
  } else {
    label = format(date, "MMM d");
  }

  return (
    <div className="mt-0.5 flex items-center gap-1">
      <CalendarIcon className="h-3 w-3" />
      <span className={className}>{label}</span>
    </div>
  );
}
