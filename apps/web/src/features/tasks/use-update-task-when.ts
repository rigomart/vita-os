import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { patchQuery } from "@/features/shared/optimistic";

import { updateTaskWhenInInbox } from "./optimistic";

export function useUpdateTaskWhen() {
  const updateTaskWhen = useMutation(api.tasks.updateWhen).withOptimisticUpdate(
    (localStore, args) => {
      patchQuery(localStore, api.tasks.list, {}, (tasks) =>
        updateTaskWhenInInbox(tasks, args.id, args.when),
      );
    },
  );

  return (id: Id<"tasks">, when: number | undefined) =>
    updateTaskWhen({ id, when });
}
