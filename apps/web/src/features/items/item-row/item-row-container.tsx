import type { Doc } from "@convex/_generated/dataModel";
import { useCompleteItem } from "@/features/items/use-complete-item";
import { useRemoveItem } from "@/features/items/use-remove-item";
import { useUncompleteItem } from "@/features/items/use-uncomplete-item";
import { useUpdateItemDate } from "@/features/items/use-update-item-date";
import { useUpdateItemText } from "@/features/items/use-update-item-text";
import { ItemRow } from "./item-row";

interface ItemRowProps {
  item: Doc<"items">;
  onProcess?: (item: Doc<"items">) => void;
}

export function ItemRowContainer({ item, onProcess }: ItemRowProps) {
  const completeItem = useCompleteItem();
  const uncompleteItem = useUncompleteItem();
  const removeItem = useRemoveItem();
  const updateItemText = useUpdateItemText();
  const updateItemDate = useUpdateItemDate();

  return (
    <ItemRow
      item={item}
      onToggleComplete={() =>
        item.isCompleted ? uncompleteItem(item._id) : completeItem(item._id)
      }
      onRemove={() => removeItem(item._id)}
      onUpdateText={(text) => updateItemText(item._id, text)}
      onUpdateDate={(date) => updateItemDate(item._id, date)}
      onProcess={onProcess ? () => onProcess(item) : undefined}
    />
  );
}
