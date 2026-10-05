import type { Thread } from "@vita-os/contracts";

import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";

import { useAttentionClock } from "../../hooks/use-attention-clock";
import { useTasks } from "../use-tasks";
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
  // Not single-flighted: Task commands queue per Thread and each shows its
  // change at once, so quick successive edits compose instead of racing.
  const tasks = useTasks(thread);

  const { run: saveFollowUp, isPending: isFollowUpPending } =
    useGuardedAsyncAction(
      async (followUp: number | null) => {
        await updateThread({ followUp });
      },
      { errorToast: true },
    );

  return (
    <ThreadAttention
      tasks={thread.tasks ?? []}
      {...(thread.focusedTaskId === undefined
        ? {}
        : { focusedTaskId: thread.focusedTaskId })}
      followUp={thread.followUp}
      now={now}
      onAddTask={(text) => void tasks.add(text)}
      onEditTask={(taskId, text) => void tasks.edit(taskId, text)}
      onRemoveTask={(taskId) => void tasks.remove(taskId)}
      onCompleteTask={(taskId) => void tasks.complete(taskId)}
      onFocusTask={(taskId) => void tasks.focus(taskId)}
      onSetFollowUp={(date) => void saveFollowUp(date)}
      onClearFollowUp={() => void saveFollowUp(null)}
      pending={{ followUp: isFollowUpPending }}
    />
  );
}
