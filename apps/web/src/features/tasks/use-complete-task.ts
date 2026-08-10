import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveFromOpenTasks } from "./optimistic";

export function useCompleteTask() {
  const completeTask = useMutation(api.tasks.markDone).withOptimisticUpdate(
    (localStore, args) => optimisticallyRemoveFromOpenTasks(localStore, args),
  );

  return (id: Id<"tasks">) => completeTask({ id });
}
