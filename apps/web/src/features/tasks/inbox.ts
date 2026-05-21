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

export function sortInboxTasks<T extends Pick<Task, "state" | "createdAt">>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    if (a.state !== b.state) {
      return a.state === "done" ? 1 : -1;
    }

    return b.createdAt - a.createdAt;
  });
}

export function completeTaskInInbox<T extends Task>(
  tasks: T[],
  id: Id<"tasks">,
  completedAt: number,
): T[] {
  return sortInboxTasks(
    tasks.map((task) =>
      task._id === id ? { ...task, state: "done", completedAt } : task,
    ),
  );
}

export function uncompleteTaskInInbox<T extends Task>(
  tasks: T[],
  id: Id<"tasks">,
): T[] {
  return sortInboxTasks(
    tasks.map((task) =>
      task._id === id
        ? { ...task, state: "open", completedAt: undefined }
        : task,
    ),
  );
}

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
