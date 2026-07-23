import { api } from "@convex/_generated/api";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useRemoveThread } from "@/features/threads/use-remove-thread";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useStableQuery } from "@/hooks/use-stable-query";

import { ThreadLifecycleMenu } from "./thread-lifecycle-menu";

interface ThreadLifecycleActionsProps {
  threadSlug: string;
  onRequestClose: () => void;
}

export function ThreadLifecycleActionsSection({
  threadSlug,
  onRequestClose,
}: ThreadLifecycleActionsProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const updateThread = useUpdateThread(threadSlug);
  const removeThread = useRemoveThread({ threadSlug });

  const { run: resolveThread, isPending: isResolving } = useGuardedAsyncAction(
    async (resolutionNote?: string) => {
      if (!thread) return;
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
      if (!thread) return;
      await updateThread({ id: thread._id, state: "open" });
    },
    { successMessage: "Thread reopened", errorToast: true },
  );

  const { run: deleteThread, isPending: isDeleting } = useGuardedAsyncAction(
    async () => {
      if (!thread) return;
      await removeThread(thread._id);
    },
    { successMessage: "Thread deleted", errorToast: true },
  );

  const handleResolve = (resolutionNote?: string) => {
    if (!thread) return;
    void resolveThread(resolutionNote).then((result) => {
      if (result.ok) {
        onRequestClose();
      }
    });
  };

  const handleReopen = () => {
    if (!thread) return;
    void reopenThread();
  };

  const handleDelete = () => {
    if (!thread) return;
    void deleteThread().then((result) => {
      if (result.ok) {
        onRequestClose();
      }
    });
  };

  if (!thread) return null;

  return (
    <ThreadLifecycleMenu
      thread={thread}
      onResolve={handleResolve}
      onReopen={handleReopen}
      onDelete={handleDelete}
      isResolving={isResolving}
      isReopening={isReopening}
      isDeleting={isDeleting}
    />
  );
}
