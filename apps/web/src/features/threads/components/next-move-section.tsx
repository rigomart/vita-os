import { api } from "@convex/_generated/api";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useCompleteNextMove } from "@/features/threads/use-complete-next-move";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useStableQuery } from "@/hooks/use-stable-query";

import { NextMove } from "./next-move";

interface NextMoveSectionProps {
  threadSlug: string;
}

export function NextMoveSection({ threadSlug }: NextMoveSectionProps) {
  const thread = useStableQuery(api.threads.getBySlug, {
    slug: threadSlug,
  });
  const updateThread = useUpdateThread(threadSlug);
  const completeNextMove = useCompleteNextMove(threadSlug);

  const { run: setNextMove, isPending: isSetPending } = useGuardedAsyncAction(
    async (text: string) => {
      if (!thread) return;
      await updateThread({ id: thread._id, nextMove: text });
    },
    { errorToast: true },
  );

  const { run: clearNextMove, isPending: isClearPending } =
    useGuardedAsyncAction(
      async () => {
        if (!thread) return;
        await updateThread({ id: thread._id, nextMove: null });
      },
      { errorToast: true },
    );

  const { run: completeNextMoveOnce, isPending: isCompletePending } =
    useGuardedAsyncAction(
      async () => {
        if (!thread) return;
        await completeNextMove(thread._id);
      },
      { errorToast: true },
    );

  const handleSet = (text: string) => {
    if (!thread) return;
    void setNextMove(text);
  };

  const handleClear = () => {
    if (!thread) return;
    void clearNextMove();
  };

  const handleComplete = () => {
    if (!thread) return;
    void completeNextMoveOnce();
  };

  return (
    <NextMove
      nextMove={thread?.nextMove ?? undefined}
      onSet={handleSet}
      onClear={handleClear}
      onComplete={handleComplete}
      pending={{
        set: isSetPending,
        clear: isClearPending,
        complete: isCompletePending,
      }}
    />
  );
}
