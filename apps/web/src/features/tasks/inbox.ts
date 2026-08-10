import type { Doc, Id } from "@convex/_generated/dataModel";

import { patchById, removeById } from "@/features/shared/optimistic";

type Task = Doc<"tasks">;

function startOfDayMs(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isTaskWhenDue(
  when: number | undefined,
  referenceDate: number,
): boolean {
  if (when === undefined) {
    return false;
  }

  return startOfDayMs(when) <= startOfDayMs(referenceDate);
}

export function isTaskWhenEmphasized(
  task: Pick<Task, "state" | "when">,
  referenceDate: number,
): boolean {
  if (task.state === "done") {
    return false;
  }

  return isTaskWhenDue(task.when, referenceDate);
}

/**
 * Removes a Task from the open Inbox list. Used both when discarding a Task
 * and when completing one: `tasks.list` holds Open Tasks only, so a Task
 * that's done no longer belongs in this cache at all — it lives on the
 * separate `tasks.listDone` page instead.
 */
export function removeTaskFromInbox<T extends Task>(
  tasks: T[],
  id: Id<"tasks">,
): T[] {
  return removeById(tasks, id);
}

export function updateTaskWhenInInbox<T extends Task>(
  tasks: T[],
  id: Id<"tasks">,
  when: number | undefined,
): T[] {
  return patchById(tasks, id, { when } as Partial<T>);
}

export function isUnprocessedTask(task: Pick<Task, "state" | "when">): boolean {
  return task.state === "open" && task.when === undefined;
}
