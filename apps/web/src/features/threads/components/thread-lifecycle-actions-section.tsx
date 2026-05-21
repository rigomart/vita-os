import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";

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

  const handleResolve = (resolutionNote?: string) => {
    if (!thread) return;
    updateThread({ id: thread._id, state: "resolved", resolutionNote });
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  const handleReopen = () => {
    if (!thread) return;
    updateThread({ id: thread._id, state: "open" });
  };

  const handleDelete = async () => {
    if (!thread) return;
    await removeThread(thread._id);
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  if (!thread) return null;

  return (
    <ThreadLifecycleActions
      thread={thread}
      onResolve={handleResolve}
      onReopen={handleReopen}
      onDelete={handleDelete}
    />
  );
}
