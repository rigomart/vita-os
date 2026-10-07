import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  AreaSummary,
  CreateThreadInput,
  Repeat,
  Task,
  TaskId,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type { ThreadUpdateDecision } from "@vita-os/core";

import {
  clearedToAbsent,
  decideAddTask,
  decideCompleteTask,
  decideEditTask,
  decideFocusTask,
  decideRemoveTask,
  decideSetTaskDate,
  decideSetTaskRepeat,
  decideSkipTask,
  generateSlug,
} from "@vita-os/core";

import {
  changeRecords,
  restoreFields,
  restoreRecords,
  insertOrdered,
  nextOrder,
  patchQueries,
  patchQuery,
  removeById,
} from "../cache/patch";
import { queryKeys } from "../query-keys";

/** Whatever a read holds of a Thread's Tasks. */
type TaskFields = {
  state: Thread["state"];
  tasks?: Task[];
  focusedTaskId?: TaskId;
};

/**
 * One Task command, shown the way the service is about to decide it: the same
 * rule runs here, so completing the Focused Task leaves the Thread unfocused on
 * screen too, and nothing is promoted. A command the rule would refuse changes
 * nothing locally; the service's refusal then rolls back the rest.
 */
function applyTaskDecision<T extends TaskFields>(
  thread: T,
  decide: (thread: T) => ThreadUpdateDecision | null,
): T {
  let decision: ThreadUpdateDecision | null;
  try {
    decision = decide(thread);
  } catch {
    return thread;
  }
  if (decision === null) return thread;
  return withoutAbsent({ ...thread, ...decision.patch } as T);
}

/**
 * Completing or skipping names the occurrence the person acted on: the date
 * the Task showed then. A repeating Task that has moved on since — a duplicate
 * activation behind the first, or a change from elsewhere — is not completed
 * or skipped again. The zone and the current time are taken once, when the
 * command is issued, so optimism computes the same next date as the service.
 */
interface OccurrenceCommand {
  taskId: TaskId;
  occurrence: number | undefined;
  timeZone: string;
  now: number;
}

export type TaskChange =
  | { kind: "add"; task: Task }
  | { kind: "edit"; taskId: TaskId; text: string }
  | { kind: "remove"; taskId: TaskId }
  | ({ kind: "complete" } & OccurrenceCommand)
  | ({ kind: "skip" } & OccurrenceCommand)
  | { kind: "focus"; taskId: TaskId | null }
  | { kind: "setDate"; taskId: TaskId; date: number | null; timeZone: string }
  | {
      kind: "setRepeat";
      taskId: TaskId;
      repeat: Repeat | null;
      timeZone: string;
    };

/** Whether the Task still shows the occurrence the command was aimed at. */
function atOccurrence(thread: TaskFields, command: OccurrenceCommand) {
  const task = thread.tasks?.find((task) => task._id === command.taskId);
  return (
    task === undefined ||
    task.repeat === undefined ||
    task.date === command.occurrence
  );
}

function decideTaskChange(
  thread: TaskFields,
  change: TaskChange,
): ThreadUpdateDecision | null {
  switch (change.kind) {
    case "add":
      return decideAddTask(thread, change.task);
    case "edit":
      return decideEditTask(thread, change.taskId, change.text);
    case "remove":
      return decideRemoveTask(thread, change.taskId);
    case "complete":
      return atOccurrence(thread, change)
        ? decideCompleteTask(thread, change.taskId, change)
        : null;
    case "skip":
      return atOccurrence(thread, change)
        ? decideSkipTask(thread, change.taskId, change)
        : null;
    case "focus":
      return decideFocusTask(thread, change.taskId);
    case "setDate":
      return decideSetTaskDate(
        thread,
        change.taskId,
        change.date,
        change.timeZone,
      );
    case "setRepeat":
      return decideSetTaskRepeat(
        thread,
        change.taskId,
        change.repeat,
        change.timeZone,
      );
  }
}

export function changeTasksLocally<T extends TaskFields>(
  thread: T,
  change: TaskChange,
): T {
  return applyTaskDecision(thread, (t) => decideTaskChange(t, change));
}

/**
 * The pending Thread, shaped like the one the service will send back. Its slug is
 * a placeholder: a link built from it resolves only once the create has returned
 * the slug the service chose.
 */
export function buildPendingThread(
  input: CreateThreadInput,
  minted: { id: ThreadId; now: number; order: number },
): Thread {
  return {
    _id: minted.id,
    title: input.title,
    slug: generateSlug(input.title),
    ...(input.summary === undefined ? {} : { summary: input.summary }),
    ...(input.areaId === undefined ? {} : { areaId: input.areaId }),
    order: minted.order,
    state: "open",
    createdAt: minted.now,
  };
}

/**
 * Patch every cached Thread detail holding this Thread, matched on what the read
 * holds — a command never knows the slug the rail subscribed with. Returning
 * `null` drops the Thread from the rail.
 */
function patchThreadDetail(
  cache: QueryClient,
  threadId: ThreadId,
  patch: (detail: ThreadDetail) => ThreadDetail | null,
): void {
  patchQueries<ThreadDetail | null>(
    cache,
    queryKeys.threads.details(),
    (detail) =>
      detail !== null && detail.thread._id === threadId
        ? patch(detail)
        : detail,
  );
}

/**
 * Exactly the reads one Thread change can touch: the open list and any rail
 * holding this Thread. Another Thread's rail is neither snapshotted nor
 * invalidated.
 */
export function threadChangeKeys(
  cache: QueryClient,
  target: { threadId?: ThreadId },
): QueryKey[] {
  const keys: QueryKey[] = [queryKeys.threads.open()];
  if (target.threadId === undefined) return keys;

  for (const [queryKey, detail] of cache.getQueriesData<ThreadDetail | null>({
    queryKey: queryKeys.threads.details(),
  })) {
    if (detail !== null && detail?.thread._id === target.threadId) {
      keys.push(queryKey);
    }
  }

  return keys;
}

export function showPendingThread(
  cache: QueryClient,
  input: CreateThreadInput,
  minted: { id: ThreadId; now: number },
): void {
  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) => [
    ...threads,
    buildPendingThread(input, { ...minted, order: nextOrder(threads) }),
  ]);
}

export function settlePendingThread(
  cache: QueryClient,
  pendingId: ThreadId,
  thread: Thread,
): void {
  const swap = (threads: Thread[]) =>
    threads.map((existing) => (existing._id === pendingId ? thread : existing));

  patchQuery<Thread[]>(cache, queryKeys.threads.open(), swap);
}

/**
 * One Thread change, across every read that can be holding it.
 *
 * `thread` is the Thread as the caller sees it: the basis for inserts into reads
 * that do not hold it yet. `destinationArea` is the Area a label change
 * targets; without it the rail's embedded Area is left for the service to
 * reconcile. Removing the label (`areaId: null`) needs no destination.
 */
export function showThreadChange(
  cache: QueryClient,
  input: UpdateThreadInput,
  context: { thread: Thread; destinationArea?: AreaSummary },
): void {
  const { threadId, resolutionNote: _resolutionNote, ...requested } = input;
  const patch = clearedToAbsent(requested);
  // Resolving takes the whole attention state with it: the Tasks, dated ones
  // included, and the focus. It has to travel in the patch, because reads are
  // patched field by field, not replaced with the Thread the caller handed us.
  const attentionPatch: Partial<Thread> =
    patch.state === "resolved"
      ? { tasks: undefined, focusedTaskId: undefined }
      : {};
  const threadPatch: Partial<Thread> = { ...patch, ...attentionPatch };
  const next = withoutAbsent({ ...context.thread, ...threadPatch });
  const resolved = threadPatch.state === "resolved";
  const reopened = threadPatch.state === "open";
  const relabeled =
    Object.hasOwn(threadPatch, "areaId") &&
    threadPatch.areaId !== context.thread.areaId;

  // A reopened Thread is absent from the open-only reads, so patching by ID would
  // silently do nothing: it is inserted where the list's ordering puts it. An
  // ordinary field change never inserts — a Thread that is missing stays missing.
  const patchOpenList = (
    threads: Thread[],
    key: (thread: Thread) => number,
  ): Thread[] => {
    if (threads.some((thread) => thread._id === threadId)) {
      return threads.map((thread) =>
        thread._id === threadId
          ? withoutAbsent({ ...thread, ...threadPatch })
          : thread,
      );
    }
    return reopened ? insertOrdered(threads, next, key) : threads;
  };

  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) =>
    resolved
      ? removeById(threads, threadId)
      : patchOpenList(threads, (thread) => thread.order),
  );

  patchThreadDetail(cache, threadId, (detail) => {
    const thread = withoutAbsent({ ...detail.thread, ...threadPatch });
    if (!relabeled) return { ...detail, thread };
    if (threadPatch.areaId === undefined) return { thread };
    const area = context.destinationArea ?? detail.area;
    return area === undefined ? { thread } : { thread, area };
  });
}

/**
 * A patch spells a cleared field as a key holding `undefined`; a read never
 * holds one. Dropping them keeps a cleared Area, say, reading as absent.
 */
function withoutAbsent<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as T;
}

/**
 * Deleting a Thread takes it out of every read holding it: the open list and
 * any rail showing it.
 */
export function showThreadRemoval(
  cache: QueryClient,
  threadId: ThreadId,
): void {
  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) =>
    removeById(threads, threadId),
  );
  patchThreadDetail(cache, threadId, () => null);
}

/**
 * A Thread's Tasks change in the same reads whatever the command: the open list
 * and every cached rail holding the Thread.
 */
function patchThreadEverywhere(
  cache: QueryClient,
  threadId: ThreadId,
  patch: (thread: Thread) => Thread,
): void {
  patchQuery<Thread[]>(cache, queryKeys.threads.open(), (threads) =>
    threads.map((thread) => (thread._id === threadId ? patch(thread) : thread)),
  );
  patchThreadDetail(cache, threadId, (detail) => ({
    ...detail,
    thread: patch(detail.thread),
  }));
}

export function showTaskChange(
  cache: QueryClient,
  threadId: ThreadId,
  change: TaskChange,
): void {
  patchThreadEverywhere(cache, threadId, (thread) =>
    changeTasksLocally(thread, change),
  );
}

/** Reconcile Task fields only, leaving concurrent Thread edits visible. */
export function settleTaskChange(cache: QueryClient, settled: Thread): void {
  patchThreadEverywhere(cache, settled._id, (thread) =>
    withoutAbsent({
      ...thread,
      tasks: settled.tasks,
      focusedTaskId: settled.focusedTaskId,
      lastActivityAt: settled.lastActivityAt,
      lastActivityContent: settled.lastActivityContent,
    }),
  );
}

/** Undo a Thread's selected fields in each read without replacing another edit. */
export function changeThread(
  cache: QueryClient,
  threadId: ThreadId,
  fields: readonly (keyof Thread)[],
  apply: () => void,
  taskIds: readonly string[] = [],
): { rollback(): void } {
  const details = cache
    .getQueriesData<ThreadDetail | null>({
      queryKey: queryKeys.threads.details(),
    })
    .filter(([, detail]) => detail?.thread._id === threadId);
  const beforeOpen = cache.getQueryData<Thread[]>(queryKeys.threads.open());
  apply();
  const afterOpen = cache.getQueryData<Thread[]>(queryKeys.threads.open());
  const detailSnapshots = details.map(([key, before]) => ({
    key,
    before,
    after: cache.getQueryData<ThreadDetail | null>(key),
  }));
  const restore = (current: Thread, before: Thread, after: Thread): Thread => {
    const restored = restoreFields(
      current,
      before,
      after,
      fields.filter((field) => field !== "tasks"),
    );
    if (fields.includes("tasks")) {
      const tasks = restoreRecords(
        current.tasks ?? [],
        before.tasks ?? [],
        after.tasks ?? [],
        taskIds,
        ["text", "date", "repeat"],
      );
      restored.tasks =
        tasks.length === 0 && before.tasks === undefined ? undefined : tasks;
    }
    return withoutAbsent(restored);
  };
  return {
    rollback: () => {
      if (beforeOpen && afterOpen)
        patchQuery<Thread[]>(cache, queryKeys.threads.open(), (current) => {
          const previous = beforeOpen.find((thread) => thread._id === threadId);
          const shown = afterOpen.find((thread) => thread._id === threadId);
          if (previous && shown)
            return current.map((thread) =>
              thread._id === threadId
                ? restore(thread, previous, shown)
                : thread,
            );
          return restoreRecords(current, beforeOpen, afterOpen, [threadId], []);
        });
      for (const { key, before, after } of detailSnapshots) {
        if (!before || after === undefined) continue;
        const current = cache.getQueryData<ThreadDetail | null>(key);
        if (current === undefined) continue;
        if (after === null) {
          if (current === null) cache.setQueryData(key, before);
          continue;
        }
        if (current === null) continue;
        const thread = restore(current.thread, before.thread, after.thread);
        const area = Object.is(current.area, after.area)
          ? before.area
          : current.area;
        cache.setQueryData(key, {
          thread,
          ...(area === undefined ? {} : { area }),
        });
      }
    },
  };
}

export function optimisticallyChangeTasks(
  cache: QueryClient,
  threadId: ThreadId,
  change: TaskChange,
): { rollback(): void } {
  const taskId =
    change.kind === "add"
      ? change.task._id
      : change.kind === "focus"
        ? undefined
        : change.taskId;
  return changeThread(
    cache,
    threadId,
    ["tasks", "focusedTaskId", "state"],
    () => showTaskChange(cache, threadId, change),
    taskId === undefined ? [] : [taskId],
  );
}

export function optimisticallyCreateThread(
  cache: QueryClient,
  input: CreateThreadInput,
  minted: { id: ThreadId; now: number },
): { rollback(): void } {
  return changeRecords<Thread>(
    cache,
    [queryKeys.threads.open()],
    [minted.id],
    [],
    () => showPendingThread(cache, input, minted),
  );
}
