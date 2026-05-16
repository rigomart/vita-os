import type { Doc } from "@convex/_generated/dataModel";
import { useProcessItem } from "@/features/items/use-process-item";
import { ProcessItemDialog } from "./process-item-dialog";

interface ProcessItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Doc<"items">;
  areas: Doc<"areas">[];
  projects: Doc<"projects">[];
}

export function ProcessItemDialogContainer({
  open,
  onOpenChange,
  item,
  areas,
  projects,
}: ProcessItemDialogProps) {
  const processItem = useProcessItem();

  return (
    <ProcessItemDialog
      open={open}
      onOpenChange={onOpenChange}
      item={item}
      areas={areas}
      projects={projects}
      onProcess={async (itemId, action) => {
        await processItem(itemId, action);
        onOpenChange(false);
      }}
    />
  );
}
