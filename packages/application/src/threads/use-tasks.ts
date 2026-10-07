import type {
  ApplicationClient,
  Repeat,
  Task,
  TaskId,
  Thread,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { isApplicationError } from "@vita-os/contracts";
import { newRecordId } from "@vita-os/core";
import { useFeedback } from "@vita-os/ui/lib/feedback";

import { useApplicationClient } from "../application-client-provider";
import { changeRecords } from "../cache/patch";
import { browserTimeZone } from "../lib/time-zone";
import { queryKeys } from "../query-keys";
import { showThreadNote } from "../thread-notes/hooks";
import { useTaskCommand } from "./hooks";

function failureMessage(error: unknown): string {
  return isApplicationError(error) && error.code === "conflict"
    ? "This Thread changed elsewhere. It has been refreshed."
    : "Could not save that change. Please try again.";
}
function useReportFailure() {
  const feedback = useFeedback();
  return (error: unknown) => feedback.error(failureMessage(error));
}
interface Occurrence {
  threadId: ThreadId;
  taskId: TaskId;
  occurrence: number | undefined;
  timeZone: string;
  now: number;
}
interface CompletionNote {
  id: ThreadNoteId;
  body: string;
}
export type CompletionNoteOutcome = "completed" | "failed" | "duplicate";
const NOT_SAVED = "Your note was not saved.";
async function findNote(
  client: ApplicationClient,
  threadId: ThreadId,
  noteId: ThreadNoteId,
): Promise<boolean | undefined> {
  try {
    const open = await client.listOpenThreadNotes({ threadId });
    if (!open.ok) return open.error.code === "not_found" ? false : undefined;
    return open.value.some((note) => note._id === noteId);
  } catch {
    return undefined;
  }
}
function occurrenceOf(thread: Thread, taskId: TaskId): Occurrence {
  return {
    threadId: thread._id,
    taskId,
    occurrence: thread.tasks?.find((task) => task._id === taskId)?.date,
    timeZone: browserTimeZone(),
    now: Date.now(),
  };
}
const occurrenceKey = ["task-occurrence"] as const;
/** Ordinary mutation state keeps completion controls pending across surfaces. */
export function useCompletingTaskIds(thread: Thread): ReadonlySet<TaskId> {
  const ids = useMutationState({
    filters: { mutationKey: [...occurrenceKey, thread._id], status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as Occurrence | undefined)?.taskId,
  });
  return new Set(ids.filter((id): id is TaskId => id !== undefined));
}
function useOccurrenceCommands(thread: Thread) {
  const cache = useQueryClient();
  const complete = useTaskCommand<Occurrence & { note?: CompletionNote }>(
    thread,
    {
      mutationKey: occurrenceKey,
      run: (client, { threadId, taskId, occurrence, timeZone, note }) =>
        client.completeTask({
          threadId,
          taskId,
          expectedOccurrence: occurrence ?? null,
          timeZone,
          ...(note === undefined ? {} : { note }),
        }),
      change: ({ note: _note, ...occurrence }) => ({
        kind: "complete",
        ...occurrence,
      }),
      alsoShows: {
        keys: ({ threadId, note }) =>
          note === undefined ? [] : [queryKeys.threadNotes.open(threadId)],
        show: (cache, { threadId, note, now }) =>
          note === undefined
            ? { rollback: () => undefined }
            : changeRecords<ThreadNote>(
                cache,
                [queryKeys.threadNotes.open(threadId)],
                [note.id],
                [],
                () =>
                  showThreadNote(cache, threadId, {
                    _id: note.id,
                    body: note.body,
                    state: "open",
                    createdAt: now,
                    updatedAt: now,
                  }),
              ),
      },
    },
  );
  const skip = useTaskCommand<Occurrence & { occurrence: number }>(thread, {
    mutationKey: occurrenceKey,
    run: (client, { threadId, taskId, occurrence, timeZone }) =>
      client.skipTask({
        threadId,
        taskId,
        expectedOccurrence: occurrence,
        timeZone,
      }),
    change: (input) => ({ kind: "skip", ...input }),
  });
  // Mutation state is marked synchronously before onMutate awaits cancelled reads.
  const pending = (taskId: TaskId) =>
    cache
      .getMutationCache()
      .findAll({
        mutationKey: [...occurrenceKey, thread._id],
        status: "pending",
      })
      .some(
        (mutation) =>
          (mutation.state.variables as Occurrence | undefined)?.taskId ===
          taskId,
      );
  return {
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
    skip: (taskId: TaskId): Promise<unknown> => {
      const task = thread.tasks?.find((task) => task._id === taskId);
      if (!task?.repeat || task.date === undefined || pending(taskId))
        return Promise.resolve();
      return skip.mutateAsync({
        ...occurrenceOf(thread, taskId),
        occurrence: task.date,
      });
    },
  };
}
interface DateInput {
  threadId: ThreadId;
  taskId: TaskId;
  date: number | null;
  timeZone: string;
}
function useSetDateCommand(thread: Thread) {
  return useTaskCommand<DateInput>(thread, {
    run: (client, input) => client.setTaskDate(input),
    change: (input) => ({ kind: "setDate", ...input }),
  });
}
interface RepeatInput {
  threadId: ThreadId;
  taskId: TaskId;
  repeat: Repeat | null;
  timeZone: string;
}
function useSetRepeatCommand(thread: Thread) {
  return useTaskCommand<RepeatInput>(thread, {
    run: (client, input) => client.setTaskRepeat(input),
    change: (input) => ({ kind: "setRepeat", ...input }),
  });
}
export function useCompleteTask(thread: Thread) {
  const report = useReportFailure();
  const { complete } = useOccurrenceCommands(thread);
  return (taskId: TaskId) => complete(taskId).then(() => undefined, report);
}
export function useSkipTask(thread: Thread) {
  const report = useReportFailure();
  const { skip } = useOccurrenceCommands(thread);
  return (taskId: TaskId) => skip(taskId).then(() => undefined, report);
}
export const FOLLOW_UP_TASK_TEXT = "Follow up";
function useAddTaskCommand(thread: Thread) {
  return useTaskCommand<{ threadId: ThreadId; task: Task }>(thread, {
    run: (client, { threadId, task }) =>
      client.addTask({
        threadId,
        taskId: task._id,
        text: task.text,
        ...(task.date === undefined ? {} : { date: task.date }),
      }),
    change: ({ task }) => ({ kind: "add", task }),
  });
}
export function useTaskDates(thread: Thread) {
  const report = useReportFailure();
  const setDate = useSetDateCommand(thread);
  const setRepeat = useSetRepeatCommand(thread);
  const addDated = useAddTaskCommand(thread);
  return {
    setDate: (taskId: TaskId, date: number | null) =>
      setDate
        .mutateAsync({
          threadId: thread._id,
          taskId,
          date,
          timeZone: browserTimeZone(),
        })
        .then(() => undefined, report),
    setRepeat: (taskId: TaskId, repeat: Repeat | null) =>
      setRepeat
        .mutateAsync({
          threadId: thread._id,
          taskId,
          repeat,
          timeZone: browserTimeZone(),
        })
        .then(() => undefined, report),
    addFollowUp: (date: number) =>
      addDated
        .mutateAsync({
          threadId: thread._id,
          task: {
            _id: newRecordId() as TaskId,
            text: FOLLOW_UP_TASK_TEXT,
            date,
          },
        })
        .then(() => undefined, report),
  };
}
/** Task commands carry the Thread identity captured when accepted. */
export function useTasks(thread: Thread) {
  const report = useReportFailure();
  const feedback = useFeedback();
  const add = useAddTaskCommand(thread);
  const edit = useTaskCommand<{
    threadId: ThreadId;
    taskId: TaskId;
    text: string;
  }>(thread, {
    run: (client, input) => client.editTask(input),
    change: (input) => ({ kind: "edit", ...input }),
  });
  const remove = useTaskCommand<{ threadId: ThreadId; taskId: TaskId }>(
    thread,
    {
      run: (client, input) => client.removeTask(input),
      change: (input) => ({ kind: "remove", ...input }),
    },
  );
  const occurrences = useOccurrenceCommands(thread);
  const focus = useTaskCommand<{ threadId: ThreadId; taskId: TaskId | null }>(
    thread,
    {
      run: (client, input) => client.focusTask(input),
      change: (input) => ({ kind: "focus", ...input }),
    },
  );
  const setDate = useSetDateCommand(thread);
  const setRepeat = useSetRepeatCommand(thread);
  const client = useApplicationClient();
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
          // Rejects without a clipboard too: the toast then stays, saying so.
          onClick: () => navigator.clipboard.writeText(note.body),
          failedMessage:
            "Couldn’t copy the note. Select its text below to copy it.",
        },
      });
      return "failed";
    };
    try {
      return (await occurrences.complete(taskId, note)) === "duplicate"
        ? "duplicate"
        : "completed";
    } catch (error) {
      // A lost response can still have saved the Note. Look up its minted ID.
      const found = await findNote(client, thread._id, note.id);
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
      return trimmed
        ? settle(
            add.mutateAsync({
              threadId: thread._id,
              task: { _id: newRecordId() as TaskId, text: trimmed },
            }),
          )
        : Promise.resolve();
    },
    edit: (taskId: TaskId, text: string) => {
      const trimmed = text.trim();
      return trimmed
        ? settle(
            edit.mutateAsync({ threadId: thread._id, taskId, text: trimmed }),
          )
        : Promise.resolve();
    },
    remove: (taskId: TaskId) =>
      settle(remove.mutateAsync({ threadId: thread._id, taskId })),
    complete: (taskId: TaskId) => settle(occurrences.complete(taskId)),
    completeWithNote,
    skip: (taskId: TaskId) => settle(occurrences.skip(taskId)),
    focus: (taskId: TaskId | null) =>
      settle(focus.mutateAsync({ threadId: thread._id, taskId })),
    setDate: (taskId: TaskId, date: number | null) =>
      settle(
        setDate.mutateAsync({
          threadId: thread._id,
          taskId,
          date,
          timeZone: browserTimeZone(),
        }),
      ),
    setRepeat: (taskId: TaskId, repeat: Repeat | null) =>
      settle(
        setRepeat.mutateAsync({
          threadId: thread._id,
          taskId,
          repeat,
          timeZone: browserTimeZone(),
        }),
      ),
  };
}
