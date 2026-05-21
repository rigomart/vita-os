import type { Doc } from "@convex/_generated/dataModel";

import { AreaFormDialog } from "./area-form-dialog";
import { useUpdateArea } from "./use-update-area";

interface EditAreaDialogProps {
  area: Doc<"areas">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAreaDialog({
  area,
  open,
  onOpenChange,
}: EditAreaDialogProps) {
  const areaSlug = area.slug ?? area._id;
  const updateArea = useUpdateArea(areaSlug);

  return (
    <AreaFormDialog
      mode="edit"
      open={open}
      onOpenChange={onOpenChange}
      initialValue={{
        name: area.name,
        standard: area.standard,
        condition: area.condition,
      }}
      onSubmit={async (value) => {
        await updateArea(area, value);
        onOpenChange(false);
      }}
    />
  );
}
