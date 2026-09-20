import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type {
  ActivityLogEntry,
  ActivityLogPage,
  ApplicationError,
  AreaSummary,
  CommandAcknowledgement,
  CompleteNextMoveOutput,
  CreateThreadInput,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";

import { useInfiniteQuery } from "@tanstack/react-query";
import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";

import { useApplicationClient } from "../application-client-provider";
import { useApplicationMutation } from "../cache/use-application-mutation";
import {
  useApplicationQuery,
  useOptionalApplicationQuery,
} from "../cache/use-application-query";
import { queryKeys } from "../query-keys";
import {
  completeNextMoveLocally,
  replaceUpNextLocally,
  settlePendingThread,
  showPendingThread,
  showThreadAttention,
  showThreadChange,
  showThreadRemoval,
  threadChangeKeys,
} from "./optimistic";

const ACTIVITY_PAGE_SIZE = 20;

/** Every Open Thread, in the person's manual order. */
export function useOpenThreads(): UseQueryResult<Thread[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.threads.open(),
    run: (client) => client.listOpenThreads(),
  });
}

/**
 * Everything the Thread rail renders: the Thread, the revision it was read at,
 * and the Area it is filed under. `null` means the Thread is not there.
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

export type ThreadActivityResult = UseInfiniteQueryResult<
  InfiniteData<ActivityLogPage>,
  ApplicationError
> & {
  /** Every entry read so far, newest first. */
  entries: ActivityLogEntry[];
};

/**
 * One Thread's Activity Log, a bounded page at a time.
 *
 * Pages already read stay read: asking for more adds to what is on screen rather
 * than replacing it.
 */
export function useThreadActivity(
  threadId: ThreadId,
  limit = ACTIVITY_PAGE_SIZE,
): ThreadActivityResult {
  const client = useApplicationClient();
  const query = useInfiniteQuery<
    ActivityLogPage,
    ApplicationError,
    InfiniteData<ActivityLogPage>,
    ReturnType<typeof queryKeys.threads.activityPage>,
    string | undefined
  >({
    queryKey: queryKeys.threads.activityPage(threadId, limit),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const result = await client.getThreadActivityPage({
        threadId,
        limit,
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
      });
      if (!result.ok) throw result.error;
      return result.value;
    },
    getNextPageParam: (page) => page.nextCursor,
    throwOnError: false,
  });

  return {
    ...query,
    entries: query.data?.pages.flatMap((page) => page.entries) ?? [],
  };
}

export function useCreateThread(): ApplicationMutationResult<
  CreateThreadInput,
  Thread,
  ThreadId
> {
  return useApplicationMutation<CreateThreadInput, Thread, ThreadId>({
    run: (client, input) => client.createThread(input),
    affected: (input, cache) =>
      threadChangeKeys(cache, { areaIds: [input.areaId] }),
    optimistic: (cache, input) => {
      const pendingId = newRecordId() as ThreadId;
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
 * The caller supplies the Thread as it sees it, and the Areas it knows about when
 * the edit can move the Thread: the optimistic change needs both to keep the open
 * list, the rail, and both Area pages in step without reading them back.
 */
export function useUpdateThread(context: {
  thread: Thread;
  areas?: AreaSummary[];
}): ApplicationMutationResult<UpdateThreadInput, Thread> {
  return useApplicationMutation<UpdateThreadInput, Thread>({
    run: (client, input) => client.updateThread(input),
    affected: (input, cache) =>
      threadChangeKeys(cache, {
        threadId: input.threadId,
        areaIds: [context.thread.areaId, input.areaId],
      }),
    optimistic: (cache, input) => {
      const destinationArea =
        input.areaId === undefined
          ? undefined
          : context.areas?.find((area) => area._id === input.areaId);
      showThreadChange(cache, input, {
        thread: context.thread,
        ...(destinationArea === undefined ? {} : { destinationArea }),
      });
    },
    // A Thread change can write Activity Log entries, which are read separately.
    alsoInvalidate: (input) => [queryKeys.threads.activity(input.threadId)],
  });
}

export function useRemoveThread(): ApplicationMutationResult<
  { threadId: ThreadId },
  CommandAcknowledgement
> {
  return useApplicationMutation<{ threadId: ThreadId }, CommandAcknowledgement>(
    {
      run: (client, input) => client.removeThread(input),
      affected: (input, cache) =>
        threadChangeKeys(cache, { threadId: input.threadId }),
      optimistic: (cache, input) => showThreadRemoval(cache, input.threadId),
    },
  );
}

/**
 * The one editing seam for Up Next: adding, editing, reordering and removing all
 * send the whole ordered line, so a rewrite never depends on what the last one
 * did. Blank moves are refused by the service — callers trim first.
 */
export function useReplaceUpNext(): ApplicationMutationResult<
  { threadId: ThreadId; moves: string[] },
  Thread
> {
  return useApplicationMutation<
    { threadId: ThreadId; moves: string[] },
    Thread
  >({
    run: (client, input) =>
      client.replaceUpNext({
        threadId: input.threadId,
        moves: sanitizeMoves(input.moves),
      }),
    affected: (input, cache) =>
      threadChangeKeys(cache, { threadId: input.threadId }),
    optimistic: (cache, input) =>
      showThreadAttention(cache, input.threadId, (thread) =>
        replaceUpNextLocally(thread, sanitizeMoves(input.moves)),
      ),
    alsoInvalidate: (input) => [queryKeys.threads.activity(input.threadId)],
  });
}

/** Nothing blank reaches the service, and nothing blank survives a rewrite. */
function sanitizeMoves(moves: readonly string[]): string[] {
  return moves.map((move) => move.trim()).filter((move) => move.length > 0);
}

export interface CompleteNextMoveVariables {
  expectedNextMove: string | null;
  expectedRevision: number;
}

/**
 * Complete the Next Move, promoting the front of Up Next when there is one.
 *
 * The expectation the caller read with the Thread travels with the command, so a
 * repeated click cannot complete a promoted move whose text matches the one
 * already completed. A stale expectation comes back as a conflict, which is
 * treated as stale data: the reads are restored and refetched, not handed to the
 * person to resolve.
 */
export function useCompleteNextMove(context: {
  threadId: ThreadId;
}): ApplicationMutationResult<
  CompleteNextMoveVariables,
  CompleteNextMoveOutput
> {
  return useApplicationMutation<
    CompleteNextMoveVariables,
    CompleteNextMoveOutput
  >({
    run: (client, variables) =>
      client.completeNextMove({ threadId: context.threadId, ...variables }),
    affected: (_variables, cache) => [
      ...threadChangeKeys(cache, { threadId: context.threadId }),
      queryKeys.threads.activity(context.threadId),
    ],
    optimistic: (cache, variables) =>
      showThreadAttention(cache, context.threadId, (thread) =>
        completeThreadWhenExpected(thread, variables),
      ),
  });
}

/**
 * The completion, applied only where the Thread still looks the way the caller
 * read it. The Activity Log stays the service's to write: inventing an entry here
 * would mean inventing an ID and a time.
 */
function completeThreadWhenExpected<
  T extends { nextMove?: string; upNext?: string[]; revision?: number },
>(thread: T, variables: CompleteNextMoveVariables): T {
  if ((thread.nextMove ?? null) !== variables.expectedNextMove) return thread;
  if (
    thread.revision !== undefined &&
    thread.revision !== variables.expectedRevision
  ) {
    return thread;
  }

  return completeNextMoveLocally(thread);
}
