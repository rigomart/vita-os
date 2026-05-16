import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { updateItemTextInInbox } from "./optimistic";

export function useUpdateItemText() {
  const updateItemText = useMutation(api.items.updateText).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.items.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.items.list,
          {},
          updateItemTextInInbox(current, args.id, args.text),
        );
      }
    },
  );

  return (id: Id<"items">, text: string) => updateItemText({ id, text });
}
