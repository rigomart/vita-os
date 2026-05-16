import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";

export function useUncompleteItem() {
  const uncompleteItem = useMutation(api.items.uncomplete).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.listCompleted, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.listCompleted,
          {},
          current.filter((item) => item._id !== args.id),
        );
      }
    },
  );

  return (id: Id<"items">) => uncompleteItem({ id });
}
