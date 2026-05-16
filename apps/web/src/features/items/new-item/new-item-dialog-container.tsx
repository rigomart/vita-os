import { useCreateItem } from "@/features/items/use-create-item";
import { NewItemDialog } from "./new-item-dialog";

interface NewItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewItemDialogContainer({
  open,
  onOpenChange,
}: NewItemDialogProps) {
  const createItem = useCreateItem();

  return (
    <NewItemDialog
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={async (value) => {
        await createItem(value);
        onOpenChange(false);
      }}
    />
  );
}
