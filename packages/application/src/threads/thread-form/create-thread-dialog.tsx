import type { AreaId } from "@vita-os/contracts";

import type { CreatedThreadResult } from "./types";

import { ThreadFormDialog } from "./thread-form-dialog";
import { useCreateThread } from "./use-create-thread";

interface CreateThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAreaId?: AreaId;
  onCreated?: (thread: CreatedThreadResult) => void;
}

export function CreateThreadDialog({
  open,
  onOpenChange,
  defaultAreaId,
  onCreated,
}: CreateThreadDialogProps) {
  const createThread = useCreateThread();

  return (
    <ThreadFormDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      defaultAreaId={defaultAreaId}
      onSubmit={async (value) => {
        const thread = await createThread(value);
        onOpenChange(false);
        onCreated?.(thread);
      }}
    />
  );
}
