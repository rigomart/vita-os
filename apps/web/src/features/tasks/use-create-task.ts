import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyAddToOpenTasks } from "./optimistic";

export type CreateTaskValue = {
  text: string;
  when?: number;
};

export function useCreateTask() {
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (localStore, args) => {
      const now = Date.now();

      optimisticallyAddToOpenTasks(localStore, {
        _id: crypto.randomUUID() as Id<"tasks">,
        _creationTime: now,
        text: args.text,
        when: args.when,
        state: "open",
        createdAt: now,
      });
    },
  );

  return (value: CreateTaskValue) => createTask(value);
}
