import type { Thread } from "@vita-os/contracts";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useAttentionClock } from "../../hooks/use-attention-clock";
import { useMoves } from "../use-moves";
import { useUpdateThread } from "../use-update-thread";
import { ThreadAttention } from "./thread-attention";

interface ThreadAttentionSectionProps {
  thread: Thread;
}

export function ThreadAttentionSection({
  thread,
}: ThreadAttentionSectionProps) {
  const now = useAttentionClock();
  const updateThread = useUpdateThread(thread);
  // Not single-flighted: Move commands queue per Thread and each shows its
  // change at once, so quick successive edits compose instead of racing.
  const moves = useMoves(thread);

  const { run: saveFollowUp, isPending: isFollowUpPending } =
    useGuardedAsyncAction(
      async (followUp: number | null) => {
        await updateThread({ followUp });
      },
      { errorToast: true },
    );

  return (
    <ThreadAttention
      moves={thread.moves ?? []}
      {...(thread.focusedMoveId === undefined
        ? {}
        : { focusedMoveId: thread.focusedMoveId })}
      followUp={thread.followUp}
      now={now}
      onAddMove={(text) => void moves.add(text)}
      onEditMove={(moveId, text) => void moves.edit(moveId, text)}
      onRemoveMove={(moveId) => void moves.remove(moveId)}
      onCompleteMove={(moveId) => void moves.complete(moveId)}
      onFocusMove={(moveId) => void moves.focus(moveId)}
      onSetFollowUp={(date) => void saveFollowUp(date)}
      onClearFollowUp={() => void saveFollowUp(null)}
      pending={{ followUp: isFollowUpPending }}
    />
  );
}
