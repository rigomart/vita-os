import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";

export type CreateItemValue = {
  text: string;
  date?: number;
};

export function useCreateItem() {
  const createItem = useMutation(api.items.create).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(api.items.list, {}, [
          {
            _id: crypto.randomUUID() as Id<"items">,
            _creationTime: Date.now(),
            userId: "",
            text: args.text,
            date: args.date,
            isCompleted: false,
            createdAt: Date.now(),
          },
          ...current,
        ]);
      }

      const count = localStore.getQuery(api.items.count, {});
      if (count !== undefined) {
        localStore.setQuery(api.items.count, {}, count + 1);
      }
    },
  );

  return (value: CreateItemValue) => createItem(value);
}
