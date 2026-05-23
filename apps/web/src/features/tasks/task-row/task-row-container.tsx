import type { Doc } from "@convex/_generated/dataModel";

import { useTaskRowActions } from "@/features/tasks/task-row/use-task-row-actions";

import { TaskRow } from "./task-row";

interface TaskRowProps {
  task: Doc<"tasks">;
  onProcess?: (task: Doc<"tasks">) => void;
}

export function TaskRowContainer({ task, onProcess }: TaskRowProps) {
  const {
    handleToggleComplete,
    isTogglePending,
    handleRemove,
    isDiscardPending,
    handleUpdateText,
    isSavingText,
    handleUpdateWhen,
    isWhenPending,
  } = useTaskRowActions(task);

  return (
    <TaskRow
      task={task}
      onToggleComplete={handleToggleComplete}
      onRemove={handleRemove}
      onUpdateText={handleUpdateText}
      onUpdateWhen={handleUpdateWhen}
      onProcess={onProcess ? () => onProcess(task) : undefined}
      isTogglePending={isTogglePending}
      isDiscardPending={isDiscardPending}
      isSavingText={isSavingText}
      isWhenPending={isWhenPending}
    />
  );
}
