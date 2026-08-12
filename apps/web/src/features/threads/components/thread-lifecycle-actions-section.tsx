import type { Doc } from "@convex/_generated/dataModel";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useRemoveThread } from "@/features/threads/use-remove-thread";
import { useUpdateThread } from "@/features/threads/use-update-thread";

import { ThreadLifecycleMenu } from "./thread-lifecycle-menu";

interface ThreadLifecycleActionsProps {
  thread: Doc<"threads">;
  onRequestClose: () => void;
}

export function ThreadLifecycleActionsSection({
  thread,
  onRequestClose,
}: ThreadLifecycleActionsProps) {
  const updateThread = useUpdateThread(thread);
  const removeThread = useRemoveThread(thread);

  const { run: resolveThread, isPending: isResolving } = useGuardedAsyncAction(
    async (resolutionNote?: string) => {
      await updateThread({
        id: thread._id,
        state: "resolved",
        resolutionNote,
      });
    },
    { successMessage: "Thread resolved", errorToast: true },
  );

  const { run: reopenThread, isPending: isReopening } = useGuardedAsyncAction(
    async () => {
      await updateThread({ id: thread._id, state: "open" });
    },
    { successMessage: "Thread reopened", errorToast: true },
  );

  const { run: deleteThread, isPending: isDeleting } = useGuardedAsyncAction(
    async () => {
      await removeThread();
    },
    { successMessage: "Thread deleted", errorToast: true },
  );

  const handleResolve = (resolutionNote?: string) => {
    void resolveThread(resolutionNote).then((result) => {
      if (result.ok) {
        onRequestClose();
      }
    });
  };

  const handleDelete = () => {
    void deleteThread().then((result) => {
      if (result.ok) {
        onRequestClose();
      }
    });
  };

  return (
    <ThreadLifecycleMenu
      thread={thread}
      onResolve={handleResolve}
      onReopen={() => void reopenThread()}
      onDelete={handleDelete}
      isResolving={isResolving}
      isReopening={isReopening}
      isDeleting={isDeleting}
    />
  );
}
