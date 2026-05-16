import type { Doc } from "@convex/_generated/dataModel";
import { useCompleteItem } from "@/features/items/use-complete-item";
import { useRemoveItem } from "@/features/items/use-remove-item";
import { ItemRow } from "./item-row";

interface ItemRowProps {
  item: Doc<"items">;
  onProcess?: (item: Doc<"items">) => void;
}

export function ItemRowContainer({ item, onProcess }: ItemRowProps) {
  const completeItem = useCompleteItem();
  const removeItem = useRemoveItem();

  return (
    <ItemRow
      item={item}
      onComplete={() => completeItem(item._id)}
      onRemove={() => removeItem(item._id)}
      onProcess={onProcess ? () => onProcess(item) : undefined}
    />
  );
}
