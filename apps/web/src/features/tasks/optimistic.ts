import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";

import { patchById, patchQuery } from "@/features/shared/optimistic";
import {
  insertTaskIntoInbox,
  removeTaskFromInbox,
} from "@/features/tasks/inbox";

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
 * Every optimistic change to the Open Tasks goes through here. `tasks.count`
 * is the length of `tasks.list` on the server — the same index read two ways —
 * so the count is derived from the patched list rather than counted up and
 * down on its own. With no cached list there is nothing to derive from, and
 * the count is left for the server to reconcile.
 */
export function patchOpenTasks(
  localStore: OptimisticLocalStore,
  patch: (tasks: Task[]) => Task[],
): void {
  const current = localStore.getQuery(api.tasks.list, {});
  if (current === undefined) return;

  const next = patch(current);
  localStore.setQuery(api.tasks.list, {}, next);
  patchQuery(localStore, api.tasks.count, {}, () => next.length);
}

/**
 * Shared cache update for taking a Task out of the open Inbox — completing
 * it and discarding it both do this the same way. `tasks.list` is Open Tasks
 * only, so either action removes the Task from that cache outright rather
 * than patching it in place.
 */
export function optimisticallyRemoveFromOpenTasks(
  localStore: OptimisticLocalStore,
  args: { id: Id<"tasks"> },
): void {
  patchOpenTasks(localStore, (tasks) => removeTaskFromInbox(tasks, args.id));
}

/**
 * Reopening a Task moves it off the `tasks.listDone` page and back onto
 * `tasks.list`, which is why the caller passes the whole document: a Done
 * Task was never in the open list to reconstruct it from. The Done row itself
 * waits for server reactivity — the paginated Done cache is left alone.
 */
export function optimisticallyReopenTask(
  localStore: OptimisticLocalStore,
  task: Task,
): void {
  patchOpenTasks(localStore, (tasks) =>
    tasks.some((existing) => existing._id === task._id)
      ? tasks
      : insertTaskIntoInbox(tasks, {
          ...task,
          state: "open",
          completedAt: undefined,
        }),
  );
}
