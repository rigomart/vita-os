import type { ProjectedThread } from "@convex/lib/validators";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useAttentionClock } from "@/hooks/use-attention-clock";

import { useCompleteNextMove } from "../use-complete-next-move";
import { useUpdateThread } from "../use-update-thread";
import { ThreadAttentionBar } from "./thread-attention-bar";

interface ThreadAttentionBarSectionProps {
  thread: ProjectedThread;
}

export function ThreadAttentionBarSection({
  thread,
}: ThreadAttentionBarSectionProps) {
  const now = useAttentionClock();
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);

  const { run: setNextMove, isPending: isSetPending } = useGuardedAsyncAction(
    async (nextMove: string) => {
      await updateThread({ id: thread._id, nextMove });
    },
    { errorToast: true },
  );

  const { run: clearNextMove, isPending: isClearPending } =
    useGuardedAsyncAction(
      async () => {
        await updateThread({ id: thread._id, nextMove: null });
      },
      { errorToast: true },
    );

  const { run: completeNextMoveOnce, isPending: isCompletePending } =
    useGuardedAsyncAction(
      async () => {
        await completeNextMove();
      },
      { errorToast: true },
    );

  const { run: saveFollowUp, isPending: isFollowUpPending } =
    useGuardedAsyncAction(
      async (followUp: number | null) => {
        await updateThread({ id: thread._id, followUp });
      },
      { errorToast: true },
    );

  return (
    <ThreadAttentionBar
      nextMove={thread.nextMove}
      followUp={thread.followUp}
      now={now}
      onSetNextMove={(text) => void setNextMove(text)}
      onClearNextMove={() => void clearNextMove()}
      onCompleteNextMove={() => void completeNextMoveOnce()}
      onSetFollowUp={(date) => void saveFollowUp(date)}
      onClearFollowUp={() => void saveFollowUp(null)}
      pending={{
        set: isSetPending,
        clear: isClearPending,
        complete: isCompletePending,
        followUp: isFollowUpPending,
      }}
    />
  );
}
