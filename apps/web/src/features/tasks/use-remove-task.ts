import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveFromOpenTasks } from "./optimistic";

export function useRemoveTask() {
  const removeTask = useMutation(api.tasks.remove).withOptimisticUpdate(
    (localStore, args) => optimisticallyRemoveFromOpenTasks(localStore, args),
  );

  return (id: Id<"tasks">) => removeTask({ id });
}
