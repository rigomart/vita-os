import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useRemoveThread } from "@/features/threads/use-remove-thread";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useStableQuery } from "@/hooks/use-stable-query";

import { ThreadLifecycleActions } from "./thread-lifecycle-actions";

interface ThreadLifecycleActionsProps {
  areaSlug: string;
  threadSlug: string;
}

export function ThreadLifecycleActionsSection({
  areaSlug,
  threadSlug,
}: ThreadLifecycleActionsProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const navigate = useNavigate();
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
        navigate({ to: "/$areaSlug", params: { areaSlug } });
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
        navigate({ to: "/$areaSlug", params: { areaSlug } });
      }
    });
  };

  if (!thread) return null;

  return (
    <ThreadLifecycleActions
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
