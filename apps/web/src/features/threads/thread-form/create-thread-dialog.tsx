import type { Doc, Id } from "@convex/_generated/dataModel";
import { ThreadFormDialog } from "./thread-form-dialog";
import type { CreatedThreadResult } from "./types";
import { useCreateThread } from "./use-create-thread";

interface CreateThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Doc<"areas">[];
  defaultAreaId?: Id<"areas">;
  onCreated?: (thread: CreatedThreadResult) => void;
}

export function CreateThreadDialog({
  open,
  onOpenChange,
  areas,
  defaultAreaId,
  onCreated,
}: CreateThreadDialogProps) {
  const createThread = useCreateThread();

  return (
    <ThreadFormDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      areas={areas}
      defaultAreaId={defaultAreaId}
      onSubmit={async (value) => {
        const thread = await createThread(value);
        onOpenChange(false);
        onCreated?.(thread);
      }}
    />
  );
}
