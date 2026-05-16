import type { Doc } from "@convex/_generated/dataModel";
import { useUncompleteItem } from "@/features/items/use-uncomplete-item";
import { CompletedItemRow } from "./completed-item-row";

interface CompletedItemRowProps {
  item: Doc<"items">;
}

export function CompletedItemRowContainer({ item }: CompletedItemRowProps) {
  const uncompleteItem = useUncompleteItem();

  return (
    <CompletedItemRow
      item={item}
      onUncomplete={() => uncompleteItem(item._id)}
    />
  );
}
