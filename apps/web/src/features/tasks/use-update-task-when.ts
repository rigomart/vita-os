import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { updateTaskWhenInInbox } from "./optimistic";

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
    },
  );

  return (id: Id<"tasks">, when: number | undefined) =>
    updateTaskWhen({ id, when });
}
