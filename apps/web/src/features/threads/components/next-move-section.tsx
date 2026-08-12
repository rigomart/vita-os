import type { Doc } from "@convex/_generated/dataModel";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useCompleteNextMove } from "@/features/threads/use-complete-next-move";
import { useUpdateThread } from "@/features/threads/use-update-thread";

import { NextMove } from "./next-move";

interface NextMoveSectionProps {
  thread: Doc<"threads">;
}

export function NextMoveSection({ thread }: NextMoveSectionProps) {
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);

  const { run: setNextMove, isPending: isSetPending } = useGuardedAsyncAction(
    async (text: string) => {
      await updateThread({ id: thread._id, nextMove: text });
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

  return (
    <NextMove
      nextMove={thread.nextMove ?? undefined}
      onSet={(text) => void setNextMove(text)}
      onClear={() => void clearNextMove()}
      onComplete={() => void completeNextMoveOnce()}
      pending={{
        set: isSetPending,
        clear: isClearPending,
        complete: isCompletePending,
      }}
    />
  );
}
