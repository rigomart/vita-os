import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

export type CreateTaskValue = {
  text: string;
  when?: number;
};

export function useCreateTask() {
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.tasks.list, {});
      if (current !== undefined) {
        localStore.setQuery(api.tasks.list, {}, [
          {
            _id: crypto.randomUUID() as Id<"tasks">,
            _creationTime: Date.now(),
            userId: "",
            text: args.text,
            when: args.when,
            state: "open",
            createdAt: Date.now(),
          },
          ...current,
        ]);
      }

      const count = localStore.getQuery(api.tasks.count, {});
      if (count !== undefined) {
        localStore.setQuery(api.tasks.count, {}, count + 1);
      }
    },
  );

  return (value: CreateTaskValue) => createTask(value);
}
