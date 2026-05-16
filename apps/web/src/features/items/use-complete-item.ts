import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";

export function useCompleteItem() {
  const completeItem = useMutation(api.items.complete).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.list,
          {},
          current.filter((item) => item._id !== args.id),
        );
      }

      const count = localStore.getQuery(api.items.count, {});
      if (count !== undefined) {
        localStore.setQuery(api.items.count, {}, Math.max(0, count - 1));
      }
    },
  );

  return (id: Id<"items">) => completeItem({ id });
}
