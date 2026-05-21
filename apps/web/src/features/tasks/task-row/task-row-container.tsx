import type { Doc } from "@convex/_generated/dataModel";
import { useCompleteTask } from "@/features/tasks/use-complete-task";
import { useRemoveTask } from "@/features/tasks/use-remove-task";
import { useUncompleteTask } from "@/features/tasks/use-uncomplete-task";
import { useUpdateTaskText } from "@/features/tasks/use-update-task-text";
import { useUpdateTaskWhen } from "@/features/tasks/use-update-task-when";
import { TaskRow } from "./task-row";

interface TaskRowProps {
  task: Doc<"tasks">;
  onProcess?: (task: Doc<"tasks">) => void;
}

export function TaskRowContainer({ task, onProcess }: TaskRowProps) {
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const removeTask = useRemoveTask();
  const updateTaskText = useUpdateTaskText();
  const updateTaskWhen = useUpdateTaskWhen();

  return (
    <TaskRow
      task={task}
      onToggleComplete={() =>
        task.state === "done"
          ? uncompleteTask(task._id)
          : completeTask(task._id)
      }
      onRemove={() => removeTask(task._id)}
      onUpdateText={(text) => updateTaskText(task._id, text)}
      onUpdateWhen={(when) => updateTaskWhen(task._id, when)}
      onProcess={onProcess ? () => onProcess(task) : undefined}
    />
  );
}
