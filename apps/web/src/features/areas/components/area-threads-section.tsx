import type { ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import {
  optimisticallyCompleteNextMove,
  optimisticallyRemoveThread,
  optimisticallyUpdateThread,
} from "@/features/threads/optimistic";
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
  const completeNextMove = useMutation(
    api.threads.completeNextMoveMutation,
  ).withOptimisticUpdate((localStore, args) => {
    const thread = threads.find(({ _id }) => _id === args.id);
    if (!thread) return;
    optimisticallyCompleteNextMove(localStore, args, { thread });
  });
  const updateThread = useMutation(api.threads.update).withOptimisticUpdate(
    (localStore, args) => {
      const thread = threads.find(({ _id }) => _id === args.id);
      if (!thread) return;
      optimisticallyUpdateThread(localStore, args, { thread });
    },
  );
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
      onCompleteNextMove={(threadId) => void completeNextMove({ id: threadId })}
      onRemoveThread={(threadId) => removeThread({ id: threadId })}
      onSetFollowUp={(threadId, when) =>
        void updateThread({ id: threadId, followUp: when ?? null })
      }
    />
  );
}
