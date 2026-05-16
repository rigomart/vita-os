import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { isUnprocessedItem, uncompleteItemInInbox } from "./optimistic";

export function useUncompleteItem() {
  const uncompleteItem = useMutation(api.items.uncomplete).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.list,
          {},
          uncompleteItemInInbox(current, args.id),
        );
      }

      const item = current?.find((item) => item._id === args.id);
      const count = localStore.getQuery(api.items.count, {});
      if (
        count !== undefined &&
        item !== undefined &&
        isUnprocessedItem({ ...item, isCompleted: false })
      ) {
        localStore.setQuery(api.items.count, {}, count + 1);
      }
    },
  );

  return (id: Id<"items">) => uncompleteItem({ id });
}
