import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { updateTaskTextInInbox } from "./optimistic";

export function useUpdateTaskText() {
  const updateTaskText = useMutation(api.tasks.updateText).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.tasks.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.tasks.list,
          {},
          updateTaskTextInInbox(current, args.id, args.text),
        );
      }
    },
  );

  return (id: Id<"tasks">, text: string) => updateTaskText({ id, text });
}
