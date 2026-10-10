import type {
  QueryClient,
  QueryKey,
  UseQueryResult,
} from "@tanstack/react-query";
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

import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";
import type { PagedResult } from "../cache/use-paged-application-query";

import { useApplicationMutation } from "../cache/use-application-mutation";
import {
  useApplicationQuery,
  useOptionalApplicationQuery,
} from "../cache/use-application-query";
import { usePagedApplicationQuery } from "../cache/use-paged-application-query";
import { clock } from "../lib/clock";
import { queryKeys } from "../query-keys";
import {
  changeThread,
  optimisticallyChangeTasks,
  optimisticallyCreateThread,
  type TaskChange,
  settleTaskChange,
  settlePendingThread,
  showThreadChange,
  showThreadRemoval,
  threadChangeKeys,
} from "./optimistic";

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
 * Everything the Thread rail renders: the Thread and its Area when it has one. `null` means the Thread is not there.
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
    optimistic: (cache, input) => {
      const pendingId = newRecordId() as ThreadId;
      const rollback = optimisticallyCreateThread(cache, input, {
        id: pendingId,
        now: clock.now(),
      });
      return { local: pendingId, ...rollback };
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

/** Edits stay attached to the Thread they were issued for, even if the surface moves. */
export function useUpdateThread(
  threadId: ThreadId,
): ApplicationMutationResult<UpdateThreadVariables, Thread> {
  return useApplicationMutation<UpdateThreadVariables, Thread>({
    mutationKey: ["update-thread", threadId],
    run: (client, { thread, destinationArea: _destination, ...change }) =>
      client.updateThread({ threadId: thread._id, ...change }),
    affected: ({ thread }, cache) =>
      threadChangeKeys(cache, { threadId: thread._id }),
    optimistic: (cache, { thread, destinationArea, ...change }) => {
      const fields = Object.keys(change).filter(
        (field) => field !== "resolutionNote",
      ) as (keyof Thread)[];
      if (change.state === "resolved") fields.push("tasks", "focusedTaskId");
      return changeThread(
        cache,
        thread._id,
        fields,
        () =>
          showThreadChange(
            cache,
            { threadId: thread._id, ...change },
            {
              thread,
              ...(destinationArea === undefined ? {} : { destinationArea }),
            },
          ),
        thread.tasks?.map((task) => task._id) ?? [],
      );
    },
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
    optimistic: (cache, { thread }) =>
      changeThread(cache, thread._id, [], () =>
        showThreadRemoval(cache, thread._id),
      ),
    // The Thread takes its Activity Log and its Notes with it.
    alsoInvalidate: ({ thread }) => [
      queryKeys.threads.activity(thread._id),
      queryKeys.threadNotes.all,
      queryKeys.threads.resolved(),
    ],
  });
}

/** A Task command uses the issued Thread identity and ordinary optimistic rollback. */
export function useTaskCommand<TInput extends { threadId: ThreadId }>(
  thread: Thread,
  command: {
    run: (
      client: ApplicationClient,
      input: TInput,
    ) => Promise<OperationResult<Thread>>;
    change: (input: TInput) => TaskChange;
    mutationKey?: readonly unknown[];
    alsoShows?: {
      keys: (input: TInput) => QueryKey[];
      show: (cache: QueryClient, input: TInput) => { rollback(): void };
    };
  },
): ApplicationMutationResult<TInput, Thread> {
  return useApplicationMutation<TInput, Thread>({
    mutationKey: [...(command.mutationKey ?? ["task-command"]), thread._id],
    run: command.run,
    affected: (input, cache) => [
      ...threadChangeKeys(cache, { threadId: input.threadId }),
      ...(command.alsoShows?.keys(input) ?? []),
    ],
    optimistic: (cache, input) => {
      const tasks = optimisticallyChangeTasks(
        cache,
        input.threadId,
        command.change(input),
      );
      const extra = command.alsoShows?.show(cache, input);
      return {
        rollback: () => {
          tasks.rollback();
          extra?.rollback();
        },
      };
    },
    reconcile: (cache, settled) => settleTaskChange(cache, settled),
    alsoInvalidate: (input) => [queryKeys.threads.activity(input.threadId)],
  });
}
