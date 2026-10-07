import type { Thread } from "@vita-os/contracts";

import { useAttentionClock } from "../../hooks/use-attention-clock";
import { useCompletingTaskIds, useTasks } from "../use-tasks";
import { ThreadAttention } from "./thread-attention";

interface ThreadAttentionSectionProps {
  thread: Thread;
}

export function ThreadAttentionSection({
  thread,
}: ThreadAttentionSectionProps) {
  const now = useAttentionClock();
  const tasks = useTasks(thread);
  const completingTaskIds = useCompletingTaskIds(thread);

  return (
    <ThreadAttention
      tasks={thread.tasks ?? []}
      completingTaskIds={completingTaskIds}
      {...(thread.focusedTaskId === undefined
        ? {}
        : { focusedTaskId: thread.focusedTaskId })}
      now={now}
      onAddTask={(text) => tasks.add(text)}
      onEditTask={(taskId, text) => tasks.edit(taskId, text)}
      onRemoveTask={(taskId) => tasks.remove(taskId)}
      onCompleteTask={(taskId) => tasks.complete(taskId)}
      onCompleteTaskWithNote={tasks.completeWithNote}
      onFocusTask={(taskId) => tasks.focus(taskId)}
      onSetTaskDate={(taskId, date) => tasks.setDate(taskId, date)}
      onSetTaskRepeat={(taskId, repeat) => tasks.setRepeat(taskId, repeat)}
      onSkipTask={(taskId) => tasks.skip(taskId)}
    />
  );
}
