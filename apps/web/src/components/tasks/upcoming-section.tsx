import type { Id } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { DueDateLabel } from "@/components/tasks/due-date-label";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useTaskMutations } from "@/hooks/use-task-mutations";

interface UpcomingTask {
  _id: Id<"tasks">;
  _creationTime: number;
  userId: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  dueDate?: number;
  projectId?: Id<"projects">;
  order: number;
  createdAt: number;
  projectName: string;
  projectSlug: string;
  areaName: string;
  areaSlug: string;
}

export function UpcomingSection({ tasks }: { tasks: UpcomingTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium">Upcoming</h2>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <CalendarClock className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No upcoming tasks with due dates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-medium">Upcoming ({tasks.length})</h2>
      <div>
        {tasks.map((task) => (
          <UpcomingTaskRow key={task._id} task={task} />
        ))}
      </div>
    </div>
  );
}

function UpcomingTaskRow({ task }: { task: UpcomingTask }) {
  const [editOpen, setEditOpen] = useState(false);
  const { updateTask } = useTaskMutations(task.projectId);

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
        <span>{task.title}</span>
        <div className="mt-0.5 flex items-center gap-1.5">
          {task.dueDate && <DueDateLabel timestamp={task.dueDate} />}
          <span className="text-xs text-muted-foreground">&middot;</span>
          <Link
            to="/$areaSlug/$projectSlug"
            params={{
              areaSlug: task.areaSlug,
              projectSlug: task.projectSlug,
            }}
            className="truncate text-xs text-muted-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {task.areaName} &rsaquo; {task.projectName}
          </Link>
        </div>
      </button>
      <EditTaskDialog
        task={task}
        projectId={task.projectId}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
