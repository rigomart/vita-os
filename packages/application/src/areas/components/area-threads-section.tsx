import type { Thread } from "@vita-os/contracts";

import { useAttentionClock } from "../../hooks/use-attention-clock";
import {
  useCompleteNextMove,
  useRemoveThread,
  useUpdateThread,
} from "../../threads/hooks";
import { AreaThreads } from "./area-threads";

interface AreaThreadsSectionProps {
  threads: Thread[];
  onCreateThread: () => void;
}

/**
 * The Area's Open Threads, wired to the commands each row offers.
 *
 * Each command carries the Thread the row is showing, so one set of commands
 * serves every row and the optimistic change always has the Thread's current
 * values — including the revision that makes a completion safe to repeat.
 */
export function AreaThreadsSection({
  threads,
  onCreateThread,
}: AreaThreadsSectionProps) {
  const currentDate = useAttentionClock();
  const completeNextMove = useCompleteNextMove();
  const updateThread = useUpdateThread();
  const removeThread = useRemoveThread();

  const threadById = (threadId: string) =>
    threads.find(({ _id }) => _id === threadId);

  return (
    <AreaThreads
      threads={threads}
      currentDate={currentDate}
      isLoading={false}
      onCreateThread={onCreateThread}
      onCompleteNextMove={(threadId) => {
        const thread = threadById(threadId);
        if (thread) void completeNextMove.mutateAsync({ thread });
      }}
      onRemoveThread={(threadId) => {
        const thread = threadById(threadId);
        if (thread) void removeThread.mutateAsync({ thread });
      }}
      onSetFollowUp={(threadId, when) => {
        const thread = threadById(threadId);
        if (thread) {
          void updateThread.mutateAsync({ thread, followUp: when ?? null });
        }
      }}
    />
  );
}
