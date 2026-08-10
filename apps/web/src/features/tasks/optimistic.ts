import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";
import { isOpenTask } from "@convex/lib/attentionOrdering";

import { patchById } from "@/features/shared/optimistic";
import { removeTaskFromInbox } from "@/features/tasks/inbox";

export {
  isUnprocessedTask,
  removeTaskFromInbox,
  updateTaskWhenInInbox,
} from "@/features/tasks/inbox";

type Task = Doc<"tasks">;

export function updateTaskTextInInbox<T extends Task>(
  tasks: T[],
  id: Id<"tasks">,
  text: string,
): T[] {
  return patchById(tasks, id, { text } as Partial<T>);
}

/**
 * Shared cache update for taking a Task out of the open Inbox — completing
 * it and discarding it both do this the same way. `tasks.list` is Open Tasks
 * only, so either action removes the Task from that cache outright rather
 * than patching it in place. `tasks.count` (the Open Task count) drops by
 * one, but only once the Task has been read back from the still-populated
 * list — which is why that lookup happens before the list is patched below.
 */
export function optimisticallyRemoveFromOpenTasks(
  localStore: OptimisticLocalStore,
  args: { id: Id<"tasks"> },
): void {
  const current = localStore.getQuery(api.tasks.list, {});
  const task = current?.find((task) => task._id === args.id);

  const count = localStore.getQuery(api.tasks.count, {});
  if (count !== undefined && task !== undefined && isOpenTask(task)) {
    localStore.setQuery(api.tasks.count, {}, Math.max(0, count - 1));
  }

  if (current !== undefined) {
    localStore.setQuery(
      api.tasks.list,
      {},
      removeTaskFromInbox(current, args.id),
    );
  }
}
