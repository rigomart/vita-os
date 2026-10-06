import type {
  Repeat,
  Task,
  TaskId,
  Thread,
  ThreadDetail,
} from "@vita-os/contracts";

import { useQueryClient } from "@tanstack/react-query";
import { isApplicationError } from "@vita-os/contracts";
import { newRecordId } from "@vita-os/core";
import { useFeedback } from "@vita-os/ui/lib/feedback";

import { browserTimeZone } from "../lib/time-zone";
import { queryKeys } from "../query-keys";
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

/** Marks the completes and skips of one Thread's Tasks. */
function occurrenceKey(thread: Thread) {
  return ["task-occurrence", thread._id] as const;
}

/**
 * Complete and skip, acting once per activation the person meant.
 *
 * The first activation moves a repeating Task to its next occurrence on
 * screen at once, so a second click of a double-click lands on a button that
 * already shows the next occurrence and would act on it too. So while a
 * complete or skip of a Task is pending, another one of that Task is not
 * issued. Once the service has answered, the next one is a deliberate act on
 * the occurrence then on screen.
 */
function useOccurrenceCommands(thread: Thread) {
  const cache = useQueryClient();
  const mutationKey = occurrenceKey(thread);
  const complete = useTaskCommand<Occurrence>(thread, {
    mutationKey,
    run: (client, { taskId, timeZone }, expectedRevision) =>
      client.completeTask({
        threadId: thread._id,
        taskId,
        timeZone,
        expectedRevision,
      }),
    change: (input) => ({ kind: "complete", ...input }),
  });
  const skip = useTaskCommand<Occurrence>(thread, {
    mutationKey,
    run: (client, { taskId, timeZone }, expectedRevision) =>
      client.skipTask({
        threadId: thread._id,
        taskId,
        timeZone,
        expectedRevision,
      }),
    change: (input) => ({ kind: "skip", ...input }),
  });

  const pending = (taskId: TaskId) =>
    cache
      .getMutationCache()
      .findAll({ mutationKey, status: "pending" })
      .some(
        (mutation) =>
          (mutation.state.variables as Occurrence | undefined)?.taskId ===
          taskId,
      );

  return {
    complete: (taskId: TaskId): Promise<unknown> =>
      pending(taskId)
        ? Promise.resolve()
        : complete.mutateAsync(occurrenceOf(thread, taskId)),
    /** Skip exists only for a repeating Task. */
    skip: (taskId: TaskId): Promise<unknown> =>
      !repeats(thread, taskId) || pending(taskId)
        ? Promise.resolve()
        : skip.mutateAsync(occurrenceOf(thread, taskId)),
  };
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
  const { complete } = useOccurrenceCommands(thread);

  return (taskId: TaskId) => complete(taskId).then(() => undefined, report);
}

/** Skip a repeating Task to its next occurrence from a Dashboard card. */
export function useSkipTask(thread: Thread) {
  const report = useReportFailure();
  const { skip } = useOccurrenceCommands(thread);

  return (taskId: TaskId) => skip(taskId).then(() => undefined, report);
}

/**
 * Whether a Task still has the date and Repeat a picker shows, in what the
 * cache holds now: the Thread still open, the Task still in it. A picker that
 * unmounts open saves its unsaved choices only then (`WhenPopover`), so a
 * refresh that brought a change from elsewhere is never undone by a stale
 * save, and nothing is sent for a Task that is gone.
 */
export function useTaskStillShown(thread: Thread) {
  const cache = useQueryClient();

  return (
    taskId: TaskId,
    shown: { when?: number; repeat?: Repeat },
  ): boolean => {
    const current =
      cache
        .getQueryData<Thread[]>(queryKeys.threads.open())
        ?.find((candidate) => candidate._id === thread._id) ??
      cache
        .getQueriesData<ThreadDetail | null>({
          queryKey: queryKeys.threads.details(),
        })
        .map(([, detail]) => detail?.thread)
        .find((candidate) => candidate?._id === thread._id);
    if (current === undefined || current.state !== "open") return false;
    const task = current.tasks?.find((candidate) => candidate._id === taskId);
    return (
      task !== undefined &&
      task.date === shown.when &&
      JSON.stringify(task.repeat ?? null) ===
        JSON.stringify(shown.repeat ?? null)
    );
  };
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
  const occurrences = useOccurrenceCommands(thread);
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
    complete: (taskId: TaskId) => settle(occurrences.complete(taskId)),
    /** Moves a repeating Task to its next occurrence; nothing is logged. */
    skip: (taskId: TaskId) => settle(occurrences.skip(taskId)),
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
