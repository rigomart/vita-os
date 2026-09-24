import { AreaFormDialog } from "./area-form-dialog";
import { useCreateArea } from "./use-create-area";

interface CreateAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAreaDialog({
  open,
  onOpenChange,
}: CreateAreaDialogProps) {
  const createArea = useCreateArea();

  return (
    <AreaFormDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={async (value) => {
        await createArea(value);
        onOpenChange(false);
      }}
    />
  );
}
