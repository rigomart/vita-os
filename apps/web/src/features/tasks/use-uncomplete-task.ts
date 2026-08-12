import type { ProjectedTask } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyReopenTask } from "./optimistic";

export function useUncompleteTask() {
  const uncompleteTask = useMutation(api.tasks.markOpen);

  return (task: ProjectedTask) =>
    uncompleteTask.withOptimisticUpdate((localStore) =>
      optimisticallyReopenTask(localStore, task),
    )({ id: task._id });
}
