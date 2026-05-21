import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { isUnprocessedTask, removeTaskFromInbox } from "./optimistic";

export function useRemoveTask() {
  const removeTask = useMutation(api.tasks.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.tasks.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.tasks.list,
          {},
          removeTaskFromInbox(current, args.id),
        );
      }

      const count = localStore.getQuery(api.tasks.count, {});
      const task = current?.find((task) => task._id === args.id);
      if (
        count !== undefined &&
        task !== undefined &&
        isUnprocessedTask(task)
      ) {
        localStore.setQuery(api.tasks.count, {}, Math.max(0, count - 1));
      }
    },
  );

  return (id: Id<"tasks">) => removeTask({ id });
}
