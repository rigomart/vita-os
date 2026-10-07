import type { QueryClient } from "@tanstack/react-query";
import type {
  ApplicationClient,
  Repeat,
  Task,
  TaskId,
  Thread,
  ThreadId,
  ThreadNoteId,
} from "@vita-os/contracts";

import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { isApplicationError } from "@vita-os/contracts";
import { newRecordId } from "@vita-os/core";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { useMemo } from "react";

import { useApplicationClient } from "../application-client-provider";
import { browserTimeZone } from "../lib/time-zone";
import { queryKeys } from "../query-keys";
import { showThreadNote } from "../thread-notes/hooks";
import { CommandDropped, useTaskCommand } from "./hooks";
import { ThreadBusy } from "./task-queue";

export { useConversionLock } from "./task-queue";

/** What a refused Task command means to the person, or nothing when it was only dropped. */
function failureMessage(error: unknown): string | undefined {
  if (error instanceof CommandDropped) return undefined;
  if (error instanceof ThreadBusy) return error.message;
  return isApplicationError(error) && error.code === "conflict"
    ? "This Thread changed elsewhere. It has been refreshed."
    : "Could not save that change. Please try again.";
}

/**
 * A Task command never throws at the surface that issued it. A refusal has
 * already been rolled back on screen; this names it for the person, so a Task
 * that reappears does not look like a glitch.
 */
function useReportFailure() {
  const feedback = useFeedback();

  return (error: unknown) => {
    const message = failureMessage(error);
    if (message !== undefined) feedback.error(message);
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

/**
 * The Thread Note a completion captures. Its ID is minted for each attempt,
 * as every client-minted ID is, so the Note shown at once is the one the
 * service keeps. A later attempt never needs an earlier one's ID: the service
 * checks the revision inside the same write, so an attempt after one that
 * landed is refused as stale and cannot add a second Note.
 */
interface CompletionNote {
  id: ThreadNoteId;
  body: string;
}

/**
 * What became of completing a Task with a note: `completed` (the answer said
 * so, or the Note was found by its ID once it failed), `failed` (the text
 * went to a toast to copy), or `duplicate` (a complete of the same Task was
 * already on its way, and nothing was sent).
 */
export type CompletionNoteOutcome = "completed" | "failed" | "duplicate";

const NOT_SAVED = "Your note was not saved.";

/**
 * Whether this attempt's Note is among the Thread's open Notes, read from the
 * service: `true` or `false`, or `undefined` when they could not be read.
 * The open Notes read takes what was found, so a Note that landed shows even
 * where no settled command refetched it. A Note archived meanwhile reads as
 * missing, which only means its text is handed back to copy.
 */
async function findNote(
  client: ApplicationClient,
  cache: QueryClient,
  threadId: ThreadId,
  noteId: ThreadNoteId,
): Promise<boolean | undefined> {
  try {
    const open = await client.listOpenThreadNotes({ threadId });
    if (!open.ok) return open.error.code === "not_found" ? false : undefined;
    cache.setQueryData(queryKeys.threadNotes.open(threadId), open.value);
    return open.value.some((note) => note._id === noteId);
  } catch {
    return undefined;
  }
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
 * The Tasks of this Thread with a complete or skip on its way. Until it is
 * answered the surface takes no new note for them, so nothing an answer
 * brings back can land on a note written meanwhile.
 */
export function useCompletingTaskIds(thread: Thread): ReadonlySet<TaskId> {
  const taskIds = useMutationState({
    filters: { mutationKey: occurrenceKey(thread), status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as Occurrence | undefined)?.taskId ?? "",
  });
  const signature = taskIds.filter(Boolean).join("\n");
  return useMemo(
    () => new Set(signature.split("\n").filter(Boolean) as TaskId[]),
    [signature],
  );
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
  // Completing with a note is the same command: it queues, guards and
  // drops exactly as a plain complete does, and its Note shows and rolls
  // back with the Task change.
  const complete = useTaskCommand<Occurrence & { note?: CompletionNote }>(
    thread,
    {
      mutationKey,
      run: (client, { taskId, timeZone, note }, expectedRevision) =>
        client.completeTask({
          threadId: thread._id,
          taskId,
          timeZone,
          expectedRevision,
          ...(note === undefined ? {} : { note }),
        }),
      change: ({ note: _note, ...occurrence }) => ({
        kind: "complete",
        ...occurrence,
      }),
      alsoShows: {
        keys: ({ note }) =>
          note === undefined ? [] : [queryKeys.threadNotes.open(thread._id)],
        show: (cache, { note, now }) => {
          if (note === undefined) return;
          showThreadNote(cache, thread._id, {
            _id: note.id,
            body: note.body,
            state: "open",
            createdAt: now,
            updatedAt: now,
          });
        },
      },
    },
  );
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
    /** Settles `duplicate` when a complete or skip of the Task is pending. */
    complete: (
      taskId: TaskId,
      note?: CompletionNote,
    ): Promise<"sent" | "duplicate"> =>
      pending(taskId)
        ? Promise.resolve("duplicate")
        : complete
            .mutateAsync({
              ...occurrenceOf(thread, taskId),
              ...(note === undefined ? {} : { note }),
            })
            .then(() => "sent"),
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
  const feedback = useFeedback();

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
  const client = useApplicationClient();
  const cache = useQueryClient();

  const settle = (pending: Promise<unknown>) =>
    pending.then(() => undefined, report);

  const completeWithNote = async (
    taskId: TaskId,
    body: string,
  ): Promise<CompletionNoteOutcome> => {
    const note: CompletionNote = {
      id: newRecordId() as ThreadNoteId,
      body: body.trim(),
    };
    // The text is never left on a surface that may be gone by now: it goes
    // to a toast that outlives the Thread pane, with the reason and a copy.
    const handBack = (message: string): CompletionNoteOutcome => {
      feedback.error(message, {
        description: note.body,
        action: {
          label: "Copy note",
          onClick: () => void navigator.clipboard?.writeText(note.body),
        },
      });
      return "failed";
    };
    try {
      return (await occurrences.complete(taskId, note)) === "duplicate"
        ? "duplicate"
        : "completed";
    } catch (error) {
      // Rolled back on screen, and the reads refetched once the queue
      // settled. Refused before it was sent, it cannot have landed.
      if (error instanceof CommandDropped) {
        return handBack(
          `This task already changed, so it was not completed. ${NOT_SAVED}`,
        );
      }
      if (error instanceof ThreadBusy) {
        return handBack(`${error.message} ${NOT_SAVED}`);
      }
      // Sent: whatever the answer said, this attempt's Note says whether it
      // landed.
      const found = await findNote(client, cache, thread._id, note.id);
      if (found === true) return "completed";
      if (found === undefined) {
        return handBack(
          "Couldn’t confirm whether the task was completed and your note saved. Check this thread’s notes before adding it again.",
        );
      }
      return handBack(
        isApplicationError(error) && error.code === "unavailable"
          ? `Couldn’t reach Vita OS. The task was not completed and your note was not saved.`
          : `${failureMessage(error)} ${NOT_SAVED}`,
      );
    }
  };

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
    /**
     * Completes the Task and captures `body` (not blank) as a Thread Note
     * in one command. Never throws: if it fails and the Note is not found
     * by its ID, the text comes back in a toast with the reason and Copy.
     */
    completeWithNote,
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
