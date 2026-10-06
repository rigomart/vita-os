import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ActivityLogEntry,
  ApplicationClient,
  ApplicationError,
  AreaSummary,
  CommandAcknowledgement,
  CreateThreadInput,
  OperationResult,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";

import { useQueryClient } from "@tanstack/react-query";
import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";
import type { PagedResult } from "../cache/use-paged-application-query";

import {
  queueMemo,
  useApplicationMutation,
} from "../cache/use-application-mutation";
import {
  useApplicationQuery,
  useOptionalApplicationQuery,
} from "../cache/use-application-query";
import { usePagedApplicationQuery } from "../cache/use-paged-application-query";
import { queryKeys } from "../query-keys";
import {
  cachedRevision,
  changesTasks,
  type TaskChange,
  settleTaskChange,
  settlePendingThread,
  showTaskChange,
  showPendingThread,
  showThreadChange,
  showThreadRemoval,
  threadChangeKeys,
} from "./optimistic";
import {
  conversionAwaitingAnswer,
  conversionPending,
  taskScope,
  ThreadBusy,
} from "./task-queue";

const ACTIVITY_PAGE_SIZE = 20;

/** Every Open Thread, in the person's manual order. */
export function useOpenThreads(
  options: { enabled?: boolean } = {},
): UseQueryResult<Thread[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.threads.open(),
    run: (client) => client.listOpenThreads(),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  });
}

/** Resolved Threads, ordered by the most recent resolution. */
export function useResolvedThreads(
  options: { enabled?: boolean } = {},
): UseQueryResult<Thread[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.threads.resolved(),
    run: (client) => client.listResolvedThreads(),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  });
}

/**
 * Everything the Thread rail renders: the Thread, the revision it was read at,
 * and its Area when it has one. `null` means the Thread is not there.
 */
export function useThreadDetail(
  slug: string,
): UseQueryResult<ThreadDetail | null, ApplicationError> {
  return useOptionalApplicationQuery({
    queryKey: queryKeys.threads.detail(slug),
    run: (client) => client.getThreadDetail({ slug }),
    // The rail renders its own not-found and failure states.
    throwOnError: false,
  });
}

/** One Thread's Activity Log, newest first, a bounded page at a time. */
export type ThreadActivityResult = PagedResult<ActivityLogEntry>;

export function useThreadActivity(
  threadId: ThreadId,
  limit = ACTIVITY_PAGE_SIZE,
): ThreadActivityResult {
  return usePagedApplicationQuery<ActivityLogEntry>({
    queryKey: queryKeys.threads.activityPage(threadId, limit),
    run: (client, cursor) =>
      client.getThreadActivityPage({
        threadId,
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      }),
    // The rail renders its own failure state beside the Thread.
    throwOnError: false,
  });
}

export function useCreateThread(): ApplicationMutationResult<
  CreateThreadInput,
  Thread,
  ThreadId
> {
  return useApplicationMutation<CreateThreadInput, Thread, ThreadId>({
    run: (client, input) => client.createThread(input),
    affected: (_input, cache) => threadChangeKeys(cache, {}),
    optimistic: (cache, input, previousLocal) => {
      const pendingId = previousLocal ?? (newRecordId() as ThreadId);
      showPendingThread(cache, input, { id: pendingId, now: Date.now() });
      return pendingId;
    },
    reconcile: (cache, thread, _input, pendingId) => {
      if (pendingId === undefined) return;
      settlePendingThread(cache, pendingId, thread);
    },
  });
}

/**
 * One Thread edit.
 *
 * Every command carries the Thread as the caller sees it, rather than reading
 * it at render: the optimistic change needs the Thread's current values. A
 * change that labels the Thread carries the destination Area too, so the
 * rail's embedded Area keeps up without reading it back.
 */
export interface UpdateThreadVariables extends Omit<
  UpdateThreadInput,
  "threadId"
> {
  thread: Thread;
  destinationArea?: AreaSummary;
}

/**
 * Edits to one Thread: title, Summary, Area, resolve and reopen.
 *
 * An edit carries no revision, but it moves the Thread's, which every Task
 * command must carry. So the edits join the Thread's Task queue: they go out
 * in turn with its Task commands, and an answer newer than the queue's basis
 * moves the basis forward, so the Task command behind it carries the edit's
 * revision. An edit only advances a basis a Task command started: unlike a
 * Task command, it can run beside a Note conversion, so its answer may
 * predate the conversion's. A fresh queue takes the revision from the reads,
 * which keep the newest answer either one brought back.
 * `threadId` names the Thread the edits issued now carry; a surface that
 * moves to another Thread leaves the edits already queued in the first one's
 * queue (`useApplicationMutation`'s `scope`).
 */
export function useUpdateThread(
  threadId: ThreadId,
): ApplicationMutationResult<UpdateThreadVariables, Thread> {
  const cache = useQueryClient();
  const scope = taskScope(threadId);

  return useApplicationMutation<UpdateThreadVariables, Thread>({
    scope,
    run: async (
      client,
      { thread, destinationArea: _destination, ...change },
    ) => {
      const result = await client.updateThread({
        threadId: thread._id,
        ...change,
      });
      const memo = queueMemo(cache);
      const basis = memo?.get(scope) as Thread | undefined;
      if (
        result.ok &&
        basis !== undefined &&
        result.value.revision > basis.revision
      ) {
        memo?.set(scope, result.value);
      }
      return result;
    },
    affected: ({ thread }, cache) =>
      threadChangeKeys(cache, { threadId: thread._id }),
    optimistic: (cache, { thread, destinationArea, ...change }) =>
      showThreadChange(
        cache,
        { threadId: thread._id, ...change },
        {
          thread,
          ...(destinationArea === undefined ? {} : { destinationArea }),
        },
      ),
    // The edit itself stays shown; the answer brings the revision it moved
    // to, with the Tasks at that revision, for the next Task command to carry.
    // While a conversion into the Thread awaits its answer, this answer may
    // predate it and would replace its pending Task, so it waits: the
    // conversion's answer replays it, before the lock lets a Task command in.
    reconcile: (cache, settled, { thread }) => {
      if (!conversionAwaitingAnswer(cache, thread)) {
        settleTaskChange(cache, settled);
      }
    },
    // A Thread change can write Activity Log entries, which are read separately.
    alsoInvalidate: ({ thread }) => [
      queryKeys.threads.activity(thread._id),
      queryKeys.threads.resolved(),
    ],
  });
}

export function useRemoveThread(): ApplicationMutationResult<
  { thread: Thread },
  CommandAcknowledgement
> {
  return useApplicationMutation<{ thread: Thread }, CommandAcknowledgement>({
    run: (client, { thread }) => client.removeThread({ threadId: thread._id }),
    affected: ({ thread }, cache) =>
      threadChangeKeys(cache, { threadId: thread._id }),
    optimistic: (cache, { thread }) => showThreadRemoval(cache, thread._id),
    // The Thread takes its Activity Log and its Notes with it.
    alsoInvalidate: ({ thread }) => [
      queryKeys.threads.activity(thread._id),
      queryKeys.threadNotes.all,
      queryKeys.threads.resolved(),
    ],
  });
}

/**
 * A Task command dropped at the head of the queue because the rule already
 * refuses it. It settles as a failure so its optimistic layer is neutralised,
 * but it is not one to report: nothing was sent and nothing went wrong.
 */
export class CommandDropped extends Error {
  constructor() {
    super("Task command dropped");
    this.name = "CommandDropped";
  }
}

/**
 * One kind of Task command, for one Thread.
 *
 * Every Task command carries the revision the Thread was read at, and the
 * service refuses a stale one. So the commands for one Thread share a scope:
 * each shows its change at once, but they reach the service one at a time, and
 * each carries the revision the one before it brought back. A refusal — a
 * Task another device already completed, say — rolls back only its own change
 * and refetches, rather than being retried against something different.
 *
 * A command the core rule already refuses against the Thread the previous
 * queued command left — the Task is gone, or nothing would change — is dropped
 * at the head of the queue: no request, no refusal to report. Duplicate
 * activations arrive before the first command's optimistic layer lands, so
 * this cannot be decided when the command is issued. The basis is the newest
 * Thread this Thread's own queue got back, and the command carries its
 * revision. The Thread's edits share the queue (`useUpdateThread`), so one
 * made meanwhile goes out in turn and its answer moves the basis forward. A
 * Note conversion never runs beside the Task commands: it waits for the
 * commands queued before it, and none can be issued while it is pending
 * (`useConversionLock`). A change made on another device is unknown here:
 * that command is still sent and refused once, and identical commands queued
 * behind a refusal are dropped rather than refused again.
 */
export function useTaskCommand<TInput>(
  thread: Thread,
  command: {
    run: (
      client: ApplicationClient,
      input: TInput,
      expectedRevision: number,
    ) => Promise<OperationResult<Thread>>;
    change: (input: TInput) => TaskChange;
  },
): ApplicationMutationResult<TInput, Thread> {
  const cache = useQueryClient();
  const scope = taskScope(thread._id);
  const refusedKey = `${scope}:refused`;

  return useApplicationMutation<TInput, Thread>({
    scope,
    // A Note being added to the Thread locks its Tasks: a command issued
    // meanwhile would move under it. The surfaces disable their controls too;
    // this catches what reaches the command anyway.
    refuse: (_input, cache) =>
      conversionPending(cache, thread) ? new ThreadBusy() : undefined,
    run: async (client, input) => {
      const change = command.change(input);
      const signature = JSON.stringify(change);
      const memo = queueMemo(cache);
      // What this Thread's own queue got back from the service. Without it
      // (the head of a fresh queue) there is nothing to decide against.
      const basis = memo?.get(scope) as Thread | undefined;
      const refused = (memo?.get(refusedKey) as string[] | undefined) ?? [];
      if (
        refused.includes(signature) ||
        (basis !== undefined && !changesTasks(basis, change))
      ) {
        throw new CommandDropped();
      }
      const result = await command.run(
        client,
        input,
        basis?.revision ?? cachedRevision(cache, thread),
      );
      if (result.ok) {
        // The basis only moves forward: an older answer never replaces it.
        if (basis === undefined || result.value.revision > basis.revision) {
          memo?.set(scope, result.value);
        }
      } else if (result.error.code === "conflict") {
        // Identical commands queued behind it are refused too, each with its own toast.
        memo?.set(refusedKey, [...refused, signature]);
      }
      return result;
    },
    affected: (_input, cache) =>
      threadChangeKeys(cache, { threadId: thread._id }),
    // Once answered, the answer carries the change (and is skipped if a newer
    // one is already shown), so the change itself is not replayed over it.
    optimistic: (cache, input, _local, answered) => {
      if (!answered) showTaskChange(cache, thread._id, command.change(input));
    },
    reconcile: (cache, settled) => settleTaskChange(cache, settled),
    // Completion writes an Activity Log entry, which is read separately.
    alsoInvalidate: () => [queryKeys.threads.activity(thread._id)],
  });
}
