import { api } from "@convex/_generated/api";
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

  const handleSet = (text: string) => {
    if (!thread) return;
    updateThread({ id: thread._id, nextMove: text });
  };

  const handleClear = () => {
    if (!thread) return;
    updateThread({ id: thread._id, nextMove: null });
  };

  const handleComplete = () => {
    if (!thread) return;
    completeNextMove(thread._id);
  };

  return (
    <NextMove
      nextMove={thread?.nextMove ?? undefined}
      onSet={handleSet}
      onClear={handleClear}
      onComplete={handleComplete}
    />
  );
}
