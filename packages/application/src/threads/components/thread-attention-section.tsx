import type { Thread } from "@vita-os/contracts";

import { useAttentionClock } from "../../hooks/use-attention-clock";
import { usePendingTaskIds } from "../task-queue";
import { useTasks } from "../use-tasks";
import { ThreadAttention } from "./thread-attention";

interface ThreadAttentionSectionProps {
  thread: Thread;
}

export function ThreadAttentionSection({
  thread,
}: ThreadAttentionSectionProps) {
  const now = useAttentionClock();
  // Not single-flighted: Task commands queue per Thread and each shows its
  // change at once, so quick successive edits compose instead of racing.
  const tasks = useTasks(thread);
  const pendingTaskIds = usePendingTaskIds();

  return (
    <ThreadAttention
      tasks={thread.tasks ?? []}
      pendingTaskIds={pendingTaskIds}
      {...(thread.focusedTaskId === undefined
        ? {}
        : { focusedTaskId: thread.focusedTaskId })}
      now={now}
      onAddTask={(text) => void tasks.add(text)}
      onEditTask={(taskId, text) => void tasks.edit(taskId, text)}
      onRemoveTask={(taskId) => void tasks.remove(taskId)}
      onCompleteTask={(taskId) => void tasks.complete(taskId)}
      onFocusTask={(taskId) => void tasks.focus(taskId)}
      onSetTaskDate={(taskId, date) => void tasks.setDate(taskId, date)}
    />
  );
}
