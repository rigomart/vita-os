import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { isUnprocessedItem, removeItemFromInbox } from "./optimistic";

export function useRemoveItem() {
  const removeItem = useMutation(api.items.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.list,
          {},
          removeItemFromInbox(current, args.id),
        );
      }

      const count = localStore.getQuery(api.items.count, {});
      const item = current?.find((item) => item._id === args.id);
      if (
        count !== undefined &&
        item !== undefined &&
        isUnprocessedItem(item)
      ) {
        localStore.setQuery(api.items.count, {}, Math.max(0, count - 1));
      }
    },
  );

  return (id: Id<"items">) => removeItem({ id });
}
