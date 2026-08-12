import type { ProjectedTask } from "@convex/lib/validators";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { useCallback } from "react";

import { useCompleteTask } from "@/features/tasks/use-complete-task";
import { useRemoveTask } from "@/features/tasks/use-remove-task";
import { useUncompleteTask } from "@/features/tasks/use-uncomplete-task";
import { useUpdateTaskText } from "@/features/tasks/use-update-task-text";
import { useUpdateTaskWhen } from "@/features/tasks/use-update-task-when";

export function useTaskRowActions(task: ProjectedTask) {
  const feedback = useFeedback();
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const removeTask = useRemoveTask();
  const updateTaskText = useUpdateTaskText();
  const updateTaskWhen = useUpdateTaskWhen();

  const { run: toggleComplete, isPending: isTogglePending } =
    useGuardedAsyncAction(
      async (intent: "complete" | "reopen") => {
        if (intent === "reopen") {
          await uncompleteTask(task);
        } else {
          await completeTask(task._id);
        }
      },
      { errorToast: true },
    );

  const handleToggleComplete = useCallback(() => {
    const intent = task.state === "done" ? "reopen" : "complete";
    void toggleComplete(intent).then((result) => {
      if (result.ok) {
        feedback.success(
          intent === "complete" ? "Task completed" : "Task reopened",
        );
      }
    });
  }, [feedback, task.state, toggleComplete]);

  const { run: discardTask, isPending: isDiscardPending } =
    useGuardedAsyncAction(
      async () => {
        await removeTask(task._id);
      },
      { successMessage: "Task discarded", errorToast: true },
    );

  const { run: saveTaskText, isPending: isSavingText } = useGuardedAsyncAction(
    async (text: string) => {
      await updateTaskText(task._id, text);
    },
    { errorToast: true },
  );

  const { run: saveTaskWhen, isPending: isWhenPending } = useGuardedAsyncAction(
    async (when: number | undefined) => {
      await updateTaskWhen(task._id, when);
    },
    { errorToast: true },
  );

  return {
    handleToggleComplete,
    isTogglePending,
    handleRemove: () => {
      void discardTask();
    },
    isDiscardPending,
    handleUpdateText: (text: string) => {
      void saveTaskText(text);
    },
    isSavingText,
    handleUpdateWhen: (when: number | undefined) => {
      void saveTaskWhen(when);
    },
    isWhenPending,
  };
}
