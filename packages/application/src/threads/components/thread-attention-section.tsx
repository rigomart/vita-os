import type { Thread } from "@vita-os/contracts";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useFeedback } from "@vita-os/ui/lib/feedback";

import { useAttentionClock } from "../../hooks/use-attention-clock";
import { useReplaceUpNext } from "../hooks";
import { useCompleteNextMove } from "../use-complete-next-move";
import { useUpdateThread } from "../use-update-thread";
import { ThreadAttention } from "./thread-attention";

interface ThreadAttentionSectionProps {
  thread: Thread;
}

export function ThreadAttentionSection({
  thread,
}: ThreadAttentionSectionProps) {
  const now = useAttentionClock();
  const feedback = useFeedback();
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);
  const replaceUpNext = useReplaceUpNext();

  const { run: setNextMove, isPending: isSetPending } = useGuardedAsyncAction(
    async (nextMove: string) => {
      await updateThread({ nextMove });
    },
    { errorToast: true },
  );

  const { run: clearNextMove, isPending: isClearPending } =
    useGuardedAsyncAction(
      async () => {
        await updateThread({ nextMove: null });
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
        await updateThread({ followUp });
      },
      { errorToast: true },
    );

  return (
    <ThreadAttention
      nextMove={thread.nextMove}
      upNext={thread.upNext ?? []}
      followUp={thread.followUp}
      now={now}
      onSetNextMove={(text) => void setNextMove(text)}
      onClearNextMove={() => void clearNextMove()}
      onCompleteNextMove={() => void completeNextMoveOnce()}
      // Not single-flighted: each rewrite carries the whole line, computed
      // from a list the optimistic update has already brought up to date, so
      // two quick edits compose instead of racing — dropping the second one
      // is the only way to lose an edit here.
      onReplaceUpNext={(moves) => {
        void replaceUpNext.mutateAsync({ thread, moves }).catch(() => {
          feedback.error("Could not save that change. Please try again.");
        });
      }}
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
