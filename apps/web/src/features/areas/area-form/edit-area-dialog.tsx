import type { ProjectedArea } from "@convex/lib/validators";

import { AreaFormDialog } from "./area-form-dialog";
import { useUpdateArea } from "./use-update-area";

interface EditAreaDialogProps {
  area: ProjectedArea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAreaDialog({
  area,
  open,
  onOpenChange,
}: EditAreaDialogProps) {
  const updateArea = useUpdateArea();

  return (
    <AreaFormDialog
      mode="edit"
      open={open}
      onOpenChange={onOpenChange}
      initialValue={{
        name: area.name,
        condition: area.condition,
        icon: area.icon,
      }}
      onSubmit={async (value) => {
        await updateArea(area, value);
        onOpenChange(false);
      }}
    />
  );
}
