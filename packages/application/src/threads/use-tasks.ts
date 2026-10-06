import type { Repeat, Task, TaskId, Thread } from "@vita-os/contracts";

import { isApplicationError } from "@vita-os/contracts";
import { newRecordId } from "@vita-os/core";
import { useFeedback } from "@vita-os/ui/lib/feedback";

import { browserTimeZone } from "../lib/time-zone";
import { CommandDropped, useTaskCommand } from "./hooks";
import { ThreadBusy } from "./task-queue";

export { useConversionLock } from "./task-queue";

/**
 * A Task command never throws at the surface that issued it. A refusal has
 * already been rolled back on screen; this names it for the person, so a Task
 * that reappears does not look like a glitch.
 */
function useReportFailure() {
  const feedback = useFeedback();

  return (error: unknown) => {
    if (error instanceof CommandDropped) return;
    if (error instanceof ThreadBusy) {
      feedback.error(error.message);
      return;
    }
    const conflict = isApplicationError(error) && error.code === "conflict";
    feedback.error(
      conflict
        ? "This Thread changed elsewhere. It has been refreshed."
        : "Could not save that change. Please try again.",
    );
  };
}

/**
 * Completing or skipping a Task, as the person did it: the occurrence the
 * Task showed (its date on screen), the browser's zone and the time it was
 * done. A repeating Task moves to its next occurrence in that zone, on screen
 * and at the service alike.
 */
interface Occurrence {
  taskId: TaskId;
  occurrence: number | undefined;
  timeZone: string;
  now: number;
}

/** Skip exists only for a repeating Task; the surfaces offer it nowhere else. */
function repeats(thread: Thread, taskId: TaskId): boolean {
  return (
    thread.tasks?.some(
      (task) => task._id === taskId && task.repeat !== undefined,
    ) ?? false
  );
}

function occurrenceOf(thread: Thread, taskId: TaskId): Occurrence {
  return {
    taskId,
    occurrence: thread.tasks?.find((task) => task._id === taskId)?.date,
    timeZone: browserTimeZone(),
    now: Date.now(),
  };
}

function useCompleteCommand(thread: Thread) {
  return useTaskCommand<Occurrence>(thread, {
    run: (client, { taskId, timeZone }, expectedRevision) =>
      client.completeTask({
        threadId: thread._id,
        taskId,
        timeZone,
        expectedRevision,
      }),
    change: (input) => ({ kind: "complete", ...input }),
  });
}

function useSkipCommand(thread: Thread) {
  return useTaskCommand<Occurrence>(thread, {
    run: (client, { taskId, timeZone }, expectedRevision) =>
      client.skipTask({
        threadId: thread._id,
        taskId,
        timeZone,
        expectedRevision,
      }),
    change: (input) => ({ kind: "skip", ...input }),
  });
}

interface DateInput {
  taskId: TaskId;
  date: number | null;
  timeZone: string;
}

/** Clearing the date clears a Repeat with it, here as at the service. */
function useSetDateCommand(thread: Thread) {
  return useTaskCommand<DateInput>(thread, {
    run: (client, input, expectedRevision) =>
      client.setTaskDate({ threadId: thread._id, ...input, expectedRevision }),
    change: (input) => ({ kind: "setDate", ...input }),
  });
}

interface RepeatInput {
  taskId: TaskId;
  repeat: Repeat | null;
  timeZone: string;
}

/** A weekly Repeat moves the date to its first chosen day, in the zone. */
function useSetRepeatCommand(thread: Thread) {
  return useTaskCommand<RepeatInput>(thread, {
    run: (client, input, expectedRevision) =>
      client.setTaskRepeat({
        threadId: thread._id,
        ...input,
        expectedRevision,
      }),
    change: (input) => ({ kind: "setRepeat", ...input }),
  });
}

/** Complete one of this Thread's Tasks from a Dashboard card. */
export function useCompleteTask(thread: Thread) {
  const report = useReportFailure();
  const complete = useCompleteCommand(thread);

  return (taskId: TaskId) =>
    complete
      .mutateAsync(occurrenceOf(thread, taskId))
      .then(() => undefined, report);
}

/** Skip a repeating Task to its next occurrence from a Dashboard card. */
export function useSkipTask(thread: Thread) {
  const report = useReportFailure();
  const skip = useSkipCommand(thread);

  return (taskId: TaskId) =>
    repeats(thread, taskId)
      ? skip
          .mutateAsync(occurrenceOf(thread, taskId))
          .then(() => undefined, report)
      : Promise.resolve();
}

/** The name of the Task a card creates when a date is set and it shows no Task. */
export const FOLLOW_UP_TASK_TEXT = "Follow up";

/**
 * The ID of the "Follow up" Task one card activation adds. It comes from the
 * Thread and the revision the card read, so a rapid duplicate activation
 * carries the same ID: the add rule refuses an ID the Thread already holds and
 * the duplicate is dropped instead of adding a second Task.
 */
export function followUpTaskId(thread: Thread): TaskId {
  let hash = 2_166_136_261;
  for (const char of `${thread._id}:${thread.revision}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
  }
  return `follow-up-${(hash >>> 0).toString(16)}-${thread.revision}` as TaskId;
}

/**
 * The date control of a Dashboard card. On a card that shows a Task it sets,
 * changes or clears that Task's date and its Repeat; on a card that shows
 * none it adds a Task named "Follow up" with the date, in one action.
 */
export function useTaskDates(thread: Thread) {
  const report = useReportFailure();
  const setDate = useSetDateCommand(thread);
  const setRepeat = useSetRepeatCommand(thread);
  const addDated = useTaskCommand<Task>(thread, {
    run: (client, task, expectedRevision) =>
      client.addTask({
        threadId: thread._id,
        taskId: task._id,
        text: task.text,
        ...(task.date === undefined ? {} : { date: task.date }),
        expectedRevision,
      }),
    change: (task) => ({ kind: "add", task }),
  });

  return {
    setDate: (taskId: TaskId, date: number | null) =>
      setDate
        .mutateAsync({ taskId, date, timeZone: browserTimeZone() })
        .then(() => undefined, report),
    setRepeat: (taskId: TaskId, repeat: Repeat | null) =>
      setRepeat
        .mutateAsync({ taskId, repeat, timeZone: browserTimeZone() })
        .then(() => undefined, report),
    addFollowUp: (date: number) =>
      addDated
        .mutateAsync({
          _id: followUpTaskId(thread),
          text: FOLLOW_UP_TASK_TEXT,
          date,
        })
        .then(() => undefined, report),
  };
}

/**
 * Every Task action Thread detail offers. Each shows its change at once, and
 * none asks for a priority: a new Task joins the end of the list unfocused,
 * with no date and no Repeat.
 */
export function useTasks(thread: Thread) {
  const report = useReportFailure();

  const add = useTaskCommand<Task>(thread, {
    run: (client, task, expectedRevision) =>
      client.addTask({
        threadId: thread._id,
        taskId: task._id,
        text: task.text,
        expectedRevision,
      }),
    change: (task) => ({ kind: "add", task }),
  });
  const edit = useTaskCommand<{ taskId: TaskId; text: string }>(thread, {
    run: (client, input, expectedRevision) =>
      client.editTask({ threadId: thread._id, ...input, expectedRevision }),
    change: (input) => ({ kind: "edit", ...input }),
  });
  const remove = useTaskCommand<TaskId>(thread, {
    run: (client, taskId, expectedRevision) =>
      client.removeTask({ threadId: thread._id, taskId, expectedRevision }),
    change: (taskId) => ({ kind: "remove", taskId }),
  });
  const complete = useCompleteCommand(thread);
  const skip = useSkipCommand(thread);
  const focus = useTaskCommand<TaskId | null>(thread, {
    run: (client, taskId, expectedRevision) =>
      client.focusTask({ threadId: thread._id, taskId, expectedRevision }),
    change: (taskId) => ({ kind: "focus", taskId }),
  });
  const setDate = useSetDateCommand(thread);
  const setRepeat = useSetRepeatCommand(thread);

  const settle = (pending: Promise<unknown>) =>
    pending.then(() => undefined, report);

  return {
    add: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return Promise.resolve();
      return settle(
        add.mutateAsync({ _id: newRecordId() as TaskId, text: trimmed }),
      );
    },
    edit: (taskId: TaskId, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return Promise.resolve();
      return settle(edit.mutateAsync({ taskId, text: trimmed }));
    },
    remove: (taskId: TaskId) => settle(remove.mutateAsync(taskId)),
    complete: (taskId: TaskId) =>
      settle(complete.mutateAsync(occurrenceOf(thread, taskId))),
    /** Moves a repeating Task to its next occurrence; nothing is logged. */
    skip: (taskId: TaskId) =>
      repeats(thread, taskId)
        ? settle(skip.mutateAsync(occurrenceOf(thread, taskId)))
        : Promise.resolve(),
    /** `null` unfocuses; focusing a Task replaces any earlier focus. */
    focus: (taskId: TaskId | null) => settle(focus.mutateAsync(taskId)),
    /** `null` clears the Task's date, and its Repeat with it. */
    setDate: (taskId: TaskId, date: number | null) =>
      settle(
        setDate.mutateAsync({ taskId, date, timeZone: browserTimeZone() }),
      ),
    /** `null` clears the Repeat and keeps the date. */
    setRepeat: (taskId: TaskId, repeat: Repeat | null) =>
      settle(
        setRepeat.mutateAsync({ taskId, repeat, timeZone: browserTimeZone() }),
      ),
  };
}
