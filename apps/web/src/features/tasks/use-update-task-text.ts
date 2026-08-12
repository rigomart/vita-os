import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { patchQuery } from "@/features/shared/optimistic";

import { updateTaskTextInInbox } from "./optimistic";

export function useUpdateTaskText() {
  const updateTaskText = useMutation(api.tasks.updateText).withOptimisticUpdate(
    (localStore, args) => {
      patchQuery(localStore, api.tasks.list, {}, (tasks) =>
        updateTaskTextInInbox(tasks, args.id, args.text),
      );
    },
  );

  return (id: Id<"tasks">, text: string) => updateTaskText({ id, text });
}
