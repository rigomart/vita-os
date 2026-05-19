import type { Doc, Id } from "@convex/_generated/dataModel";
import { patchById, removeById } from "@/features/shared/optimistic";

type Task = Doc<"items">;

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
  task: Pick<Task, "isCompleted" | "date">,
  referenceDate: number,
): boolean {
  if (task.isCompleted) {
    return false;
  }

  return isTaskWhenDue(task.date, referenceDate);
}

export function sortInboxTasks<
  T extends Pick<Task, "isCompleted" | "createdAt">,
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }

    return b.createdAt - a.createdAt;
  });
}

export function completeTaskInInbox<T extends Task>(
  tasks: T[],
  id: Id<"items">,
  completedAt: number,
): T[] {
  return sortInboxTasks(
    tasks.map((task) =>
      task._id === id ? { ...task, isCompleted: true, completedAt } : task,
    ),
  );
}

export function uncompleteTaskInInbox<T extends Task>(
  tasks: T[],
  id: Id<"items">,
): T[] {
  return sortInboxTasks(
    tasks.map((task) =>
      task._id === id
        ? { ...task, isCompleted: false, completedAt: undefined }
        : task,
    ),
  );
}

export function removeTaskFromInbox<T extends Task>(
  tasks: T[],
  id: Id<"items">,
): T[] {
  return removeById(tasks, id);
}

export function updateTaskWhenInInbox<T extends Task>(
  tasks: T[],
  id: Id<"items">,
  when: number | undefined,
): T[] {
  return patchById(tasks, id, { date: when } as Partial<T>);
}

export function isUnprocessedTask(
  task: Pick<Task, "isCompleted" | "date">,
): boolean {
  return !task.isCompleted && task.date === undefined;
}
