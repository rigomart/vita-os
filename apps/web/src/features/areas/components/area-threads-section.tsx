import type { ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyRemoveThread } from "@/features/threads/optimistic";
import { useAttentionClock } from "@/hooks/use-attention-clock";

import { AreaThreads } from "./area-threads";

interface AreaThreadsSectionProps {
  threads: ProjectedThread[];
  onCreateThread: () => void;
}

export function AreaThreadsSection({
  threads,
  onCreateThread,
}: AreaThreadsSectionProps) {
  const currentDate = useAttentionClock();
  const removeThread = useMutation(api.threads.remove).withOptimisticUpdate(
    (localStore, args) => {
      const thread = threads.find(({ _id }) => _id === args.id);
      if (!thread) return;
      optimisticallyRemoveThread(localStore, args, { thread });
    },
  );

  return (
    <AreaThreads
      threads={threads}
      currentDate={currentDate}
      isLoading={false}
      onCreateThread={onCreateThread}
      onRemoveThread={(threadId) => removeThread({ id: threadId })}
    />
  );
}
