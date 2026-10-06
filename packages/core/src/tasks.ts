import type { Task, TaskId, ThreadState } from "@vita-os/contracts";

import type { ThreadUpdateDecision } from "./thread-changes";

import { soonestTaskDate, startOfLocalDay } from "./attention";
import { ConflictError, ValidationError } from "./errors";
import { requireNonBlankText } from "./text";

/**
 * Tasks: the useful actions a Thread holds, as peers. They are kept in the
 * order they were captured, which is for finding things and never a priority,
 * and the person may single out one of them as the Focused Task.
 *
 * Every rule here decides one command against the Thread as it was read. A rule
 * that names a Task the Thread no longer holds answers `null`: the caller saw a
 * different Thread, so the command is refused rather than applied to something
 * else.
 *
 * Only completion writes to the Activity Log. Adding, editing, removing and
 * focusing are silent, so the log stays about what happened to the situation.
 */

export interface TaskState {
  state: ThreadState;
  tasks?: Task[];
  focusedTaskId?: TaskId;
}

/** A Task date is a sane instant: 1970-01-01 through 9999-12-31, whole milliseconds. */
export const MIN_TASK_DATE = 0;
export const MAX_TASK_DATE = 253_402_300_799_999;

export function isTaskDate(date: number): boolean {
  return (
    Number.isSafeInteger(date) && date >= MIN_TASK_DATE && date <= MAX_TASK_DATE
  );
}

export function requireTaskDate(date: number): number {
  if (
    !Number.isSafeInteger(date) ||
    date < MIN_TASK_DATE ||
    date > MAX_TASK_DATE
  ) {
    throw new ValidationError("Invalid date");
  }
  return date;
}

/** A Task ID is opaque, but it has to be something a URL and a row can hold. */
const MAX_TASK_ID_LENGTH = 64;

export function requireTaskText(text: string): string {
  return requireNonBlankText(text, "Task");
}

export function requireTaskId(taskId: string): TaskId {
  if (taskId.length === 0 || taskId.length > MAX_TASK_ID_LENGTH) {
    throw new ValidationError("Invalid Task");
  }
  return taskId as TaskId;
}

/**
 * Adding, editing and focusing are open-Thread edits. A resolved Thread
 * discarded its Tasks, and a finished situation cannot quietly gain new work.
 */
export function requireOpenForTasks(thread: { state: ThreadState }): void {
  if (thread.state !== "open") {
    throw new ConflictError("Cannot change the tasks of a resolved thread");
  }
}

/** The list as the Thread stores it — absent once nothing is left. */
function stored(tasks: readonly Task[]): Task[] | undefined {
  return tasks.length > 0 ? [...tasks] : undefined;
}

function findTask(thread: TaskState, taskId: TaskId): Task | undefined {
  return thread.tasks?.find((task) => task._id === taskId);
}

/** The list without one Task, and focus cleared if it was the one focused. */
function without(thread: TaskState, taskId: TaskId) {
  return {
    tasks: stored((thread.tasks ?? []).filter((task) => task._id !== taskId)),
    ...(thread.focusedTaskId === taskId ? { focusedTaskId: undefined } : {}),
  };
}

/**
 * A new Task joins the end of the list, unfocused: capturing never asks
 * whether it matters most. An ID the Thread already holds is a conflict.
 */
export function decideAddTask(
  thread: TaskState,
  task: Task,
): ThreadUpdateDecision | null {
  requireOpenForTasks(thread);
  if (findTask(thread, task._id)) return null;
  if (task.date !== undefined) requireTaskDate(task.date);

  return {
    patch: { tasks: [...(thread.tasks ?? []), task] },
    logs: [],
  };
}

export function decideEditTask(
  thread: TaskState,
  taskId: TaskId,
  text: string,
): ThreadUpdateDecision | null {
  requireOpenForTasks(thread);
  const task = findTask(thread, taskId);
  if (!task) return null;
  if (task.text === text) return { patch: {}, logs: [] };

  return {
    patch: {
      tasks: (thread.tasks ?? []).map((existing) =>
        existing._id === taskId ? { ...existing, text } : existing,
      ),
    },
    logs: [],
  };
}

/** A dropped idea leaves no trace in the Activity Log. */
export function decideRemoveTask(
  thread: TaskState,
  taskId: TaskId,
): ThreadUpdateDecision | null {
  if (!findTask(thread, taskId)) return null;

  return { patch: without(thread, taskId), logs: [] };
}

/**
 * Completing any Task — focused or not — takes it off the Thread and records
 * it. Completing the Focused Task leaves the Thread unfocused: nothing is
 * promoted, so the app never picks the next focus. Completing the last Task
 * leaves the Thread open; the situation may still need attention.
 */
export function decideCompleteTask(
  thread: TaskState,
  taskId: TaskId,
): ThreadUpdateDecision | null {
  const task = findTask(thread, taskId);
  if (!task) return null;

  return {
    patch: without(thread, taskId),
    logs: [
      {
        type: "move_completed",
        content: `Completed "${task.text}"`,
        previousValue: task.text,
      },
    ],
  };
}

/**
 * Set, change or (with `null`) clear one Task's date. A date resurfaces the
 * Thread and is never a deadline, so the change writes nothing to the Activity
 * Log. Setting the date a Task already has changes nothing.
 */
export function decideSetTaskDate(
  thread: TaskState,
  taskId: TaskId,
  date: number | null,
): ThreadUpdateDecision | null {
  requireOpenForTasks(thread);
  if (date !== null) requireTaskDate(date);
  const task = findTask(thread, taskId);
  if (!task) return null;
  if ((task.date ?? null) === date) return { patch: {}, logs: [] };

  const { date: _previous, ...undated } = task;
  const changed: Task = date === null ? undated : { ...undated, date };
  return {
    patch: {
      tasks: (thread.tasks ?? []).map((existing) =>
        existing._id === taskId ? changed : existing,
      ),
    },
    logs: [],
  };
}

/**
 * Focus one Task, replacing any earlier focus, or (with `null`) none. The
 * toggle a surface offers — focusing the focused Task unfocuses it — is the
 * surface's to compute; this rule only sets what it is told.
 */
export function decideFocusTask(
  thread: TaskState,
  taskId: TaskId | null,
): ThreadUpdateDecision | null {
  requireOpenForTasks(thread);
  if (taskId !== null && !findTask(thread, taskId)) return null;

  const focusedTaskId = taskId ?? undefined;
  if (focusedTaskId === thread.focusedTaskId) return { patch: {}, logs: [] };

  return { patch: { focusedTaskId }, logs: [] };
}

/**
 * The Task a card leads with: the Focused Task, else the only Task. With
 * several Tasks and none focused there is no lead — the card must not invent
 * a headline the person never chose.
 */
export function leadTask(thread: {
  tasks?: readonly Task[];
  focusedTaskId?: TaskId;
}): Task | undefined {
  const tasks = thread.tasks ?? [];
  const focused = tasks.find((task) => task._id === thread.focusedTaskId);
  if (focused) return focused;
  return tasks.length === 1 ? tasks[0] : undefined;
}

export function hasTasks(thread: { tasks?: readonly Task[] }): boolean {
  return (thread.tasks?.length ?? 0) > 0;
}

/**
 * What a Thread's card shows in its Task slot.
 *
 * With dated Tasks the one that placed the Thread leads, even when another is
 * focused; two on the soonest day lead with no single Task, because the card
 * must not pick between them. Without a dated Task the slot is today's rule:
 * the Focused Task, else the only Task, else a count.
 */
export type TaskSlot =
  | { kind: "none" }
  | { kind: "task"; task: Task; focused: boolean }
  | { kind: "sameDay"; count: number; date: number }
  | { kind: "unfocused"; count: number };

export function taskSlot(thread: {
  tasks?: readonly Task[];
  focusedTaskId?: TaskId;
}): TaskSlot {
  const tasks = thread.tasks ?? [];
  if (tasks.length === 0) return { kind: "none" };

  const soonest = soonestTaskDate(tasks);
  if (soonest !== undefined) {
    const day = startOfLocalDay(soonest);
    const sameDay = tasks.filter(
      (task) => task.date !== undefined && startOfLocalDay(task.date) === day,
    );
    if (sameDay.length > 1) {
      return { kind: "sameDay", count: sameDay.length, date: soonest };
    }
    const lead = sameDay[0]!;
    return {
      kind: "task",
      task: lead,
      focused: lead._id === thread.focusedTaskId,
    };
  }

  const lead = leadTask(thread);
  return lead === undefined
    ? { kind: "unfocused", count: tasks.length }
    : { kind: "task", task: lead, focused: lead._id === thread.focusedTaskId };
}
