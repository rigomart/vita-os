import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { isUnprocessedTask, uncompleteTaskInInbox } from "./optimistic";

export function useUncompleteTask() {
  const uncompleteTask = useMutation(api.tasks.markOpen).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.tasks.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.tasks.list,
          {},
          uncompleteTaskInInbox(current, args.id),
        );
      }

      const task = current?.find((task) => task._id === args.id);
      const count = localStore.getQuery(api.tasks.count, {});
      if (
        count !== undefined &&
        task !== undefined &&
        isUnprocessedTask({ ...task, state: "open" })
      ) {
        localStore.setQuery(api.tasks.count, {}, count + 1);
      }
    },
  );

  return (id: Id<"tasks">) => uncompleteTask({ id });
}
