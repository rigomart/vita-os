import type { Task, TaskId, Thread } from "@vita-os/contracts";

import { isApplicationError } from "@vita-os/contracts";
import { newRecordId } from "@vita-os/core";
import { useFeedback } from "@vita-os/ui/lib/feedback";

import { CommandDropped, useTaskCommand } from "./hooks";

/**
 * A Task command never throws at the surface that issued it. A refusal has
 * already been rolled back on screen; this names it for the person, so a Task
 * that reappears does not look like a glitch.
 */
function useReportFailure() {
  const feedback = useFeedback();

  return (error: unknown) => {
    if (error instanceof CommandDropped) return;
    const conflict = isApplicationError(error) && error.code === "conflict";
    feedback.error(
      conflict
        ? "This Thread changed elsewhere. It has been refreshed."
        : "Could not save that change. Please try again.",
    );
  };
}

/** Complete one of this Thread's Tasks: all the Dashboard card can do. */
export function useCompleteTask(thread: Thread) {
  const report = useReportFailure();
  const complete = useTaskCommand<TaskId>(thread, {
    run: (client, taskId, expectedRevision) =>
      client.completeTask({ threadId: thread._id, taskId, expectedRevision }),
    change: (taskId) => ({ kind: "complete", taskId }),
  });

  return (taskId: TaskId) =>
    complete.mutateAsync(taskId).then(() => undefined, report);
}

/** The name of the Task a card creates when a date is set and it shows no Task. */
export const FOLLOW_UP_TASK_TEXT = "Follow up";

/**
 * The date control of a Dashboard card. On a card that shows a Task it sets,
 * changes or clears that Task's date; on a card that shows none it adds a Task
 * named "Follow up" with the date, in one action.
 */
export function useTaskDates(thread: Thread) {
  const report = useReportFailure();
  const setDate = useTaskCommand<{ taskId: TaskId; date: number | null }>(
    thread,
    {
      run: (client, input, expectedRevision) =>
        client.setTaskDate({
          threadId: thread._id,
          ...input,
          expectedRevision,
        }),
      change: (input) => ({ kind: "setDate", ...input }),
    },
  );
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
      setDate.mutateAsync({ taskId, date }).then(() => undefined, report),
    addFollowUp: (date: number) =>
      addDated
        .mutateAsync({
          _id: newRecordId() as TaskId,
          text: FOLLOW_UP_TASK_TEXT,
          date,
        })
        .then(() => undefined, report),
  };
}

/**
 * Every Task action Thread detail offers. Each shows its change at once, and
 * none asks for a priority: a new Task joins the end of the list unfocused.
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
  const complete = useTaskCommand<TaskId>(thread, {
    run: (client, taskId, expectedRevision) =>
      client.completeTask({ threadId: thread._id, taskId, expectedRevision }),
    change: (taskId) => ({ kind: "complete", taskId }),
  });
  const focus = useTaskCommand<TaskId | null>(thread, {
    run: (client, taskId, expectedRevision) =>
      client.focusTask({ threadId: thread._id, taskId, expectedRevision }),
    change: (taskId) => ({ kind: "focus", taskId }),
  });
  const setDate = useTaskCommand<{ taskId: TaskId; date: number | null }>(
    thread,
    {
      run: (client, input, expectedRevision) =>
        client.setTaskDate({
          threadId: thread._id,
          ...input,
          expectedRevision,
        }),
      change: (input) => ({ kind: "setDate", ...input }),
    },
  );

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
    complete: (taskId: TaskId) => settle(complete.mutateAsync(taskId)),
    /** `null` unfocuses; focusing a Task replaces any earlier focus. */
    focus: (taskId: TaskId | null) => settle(focus.mutateAsync(taskId)),
    /** `null` clears the Task's date. */
    setDate: (taskId: TaskId, date: number | null) =>
      settle(setDate.mutateAsync({ taskId, date })),
  };
}
