import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { patchOpenTasks } from "./optimistic";

export type CreateTaskValue = {
  text: string;
  when?: number;
};

export function useCreateTask() {
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (localStore, args) => {
      patchOpenTasks(localStore, (tasks) => [
        {
          _id: crypto.randomUUID() as Id<"tasks">,
          _creationTime: Date.now(),
          userId: "",
          text: args.text,
          when: args.when,
          state: "open",
          createdAt: Date.now(),
        },
        ...tasks,
      ]);
    },
  );

  return (value: CreateTaskValue) => createTask(value);
}
