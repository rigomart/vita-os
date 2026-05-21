import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { isUnprocessedTask, updateTaskWhenInInbox } from "./optimistic";

export function useUpdateTaskWhen() {
  const updateTaskWhen = useMutation(api.tasks.updateWhen).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.tasks.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.tasks.list,
          {},
          updateTaskWhenInInbox(current, args.id, args.when),
        );
      }

      const count = localStore.getQuery(api.tasks.count, {});
      const task = current?.find((task) => task._id === args.id);
      if (count === undefined || task === undefined) {
        return;
      }

      const wasUnprocessed = isUnprocessedTask(task);
      const isNowUnprocessed = isUnprocessedTask({ ...task, when: args.when });

      if (wasUnprocessed && !isNowUnprocessed) {
        localStore.setQuery(api.tasks.count, {}, Math.max(0, count - 1));
      } else if (!wasUnprocessed && isNowUnprocessed) {
        localStore.setQuery(api.tasks.count, {}, count + 1);
      }
    },
  );

  return (id: Id<"tasks">, when: number | undefined) =>
    updateTaskWhen({ id, when });
}
