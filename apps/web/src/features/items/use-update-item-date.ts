import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { isUnprocessedItem, updateItemDateInInbox } from "./optimistic";

export function useUpdateItemDate() {
  const updateItemDate = useMutation(api.items.updateDate).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.list,
          {},
          updateItemDateInInbox(current, args.id, args.date),
        );
      }

      const count = localStore.getQuery(api.items.count, {});
      const item = current?.find((item) => item._id === args.id);
      if (count === undefined || item === undefined) {
        return;
      }

      const wasUnprocessed = isUnprocessedItem(item);
      const isNowUnprocessed = isUnprocessedItem({ ...item, date: args.date });

      if (wasUnprocessed && !isNowUnprocessed) {
        localStore.setQuery(api.items.count, {}, Math.max(0, count - 1));
      } else if (!wasUnprocessed && isNowUnprocessed) {
        localStore.setQuery(api.items.count, {}, count + 1);
      }
    },
  );

  return (id: Id<"items">, date: number | undefined) =>
    updateItemDate({ id, date });
}
