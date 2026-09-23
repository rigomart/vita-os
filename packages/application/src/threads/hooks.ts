import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ActivityLogEntry,
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

import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";
import type { PagedResult } from "../cache/use-paged-application-query";

import { useApplicationMutation } from "../cache/use-application-mutation";
import {
  useApplicationQuery,
  useOptionalApplicationQuery,
} from "../cache/use-application-query";
import { usePagedApplicationQuery } from "../cache/use-paged-application-query";
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
export function useOpenThreads(
  options: { enabled?: boolean } = {},
): UseQueryResult<Thread[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.threads.open(),
    run: (client) => client.listOpenThreads(),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
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
    affected: (input, cache) =>
      threadChangeKeys(cache, { areaIds: [input.areaId] }),
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
 * Every command carries the Thread as the caller sees it, rather than being bound
 * to one at render: the optimistic change needs the Thread's current values, and a
 * surface that lists many Threads has one command for all of them. A change that
 * moves the Thread carries the destination Area too, so the rail's embedded Area
 * keeps up without reading it back.
 */
export interface UpdateThreadVariables extends Omit<
  UpdateThreadInput,
  "threadId"
> {
  thread: Thread;
  destinationArea?: AreaSummary;
}

export function useUpdateThread(): ApplicationMutationResult<
  UpdateThreadVariables,
  Thread
> {
  return useApplicationMutation<UpdateThreadVariables, Thread>({
    run: (client, { thread, destinationArea: _destination, ...change }) =>
      client.updateThread({ threadId: thread._id, ...change }),
    affected: ({ thread, areaId }, cache) =>
      threadChangeKeys(cache, {
        threadId: thread._id,
        areaIds: [thread.areaId, areaId],
      }),
    optimistic: (cache, { thread, destinationArea, ...change }) =>
      showThreadChange(
        cache,
        { threadId: thread._id, ...change },
        {
          thread,
          ...(destinationArea === undefined ? {} : { destinationArea }),
        },
      ),
    // A Thread change can write Activity Log entries, which are read separately.
    alsoInvalidate: ({ thread }) => [queryKeys.threads.activity(thread._id)],
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
    ],
  });
}

/**
 * The one editing seam for Up Next: adding, editing, reordering and removing all
 * send the whole ordered line, so a rewrite never depends on what the last one
 * did. Blank moves are refused by the service — callers trim first.
 */
export function useReplaceUpNext(): ApplicationMutationResult<
  { thread: Thread; moves: string[] },
  Thread
> {
  return useApplicationMutation<{ thread: Thread; moves: string[] }, Thread>({
    run: (client, input) =>
      client.replaceUpNext({
        threadId: input.thread._id,
        moves: sanitizeMoves(input.moves),
      }),
    affected: ({ thread }, cache) =>
      threadChangeKeys(cache, { threadId: thread._id }),
    optimistic: (cache, input) =>
      showThreadAttention(cache, input.thread._id, (thread) =>
        replaceUpNextLocally(thread, sanitizeMoves(input.moves)),
      ),
    alsoInvalidate: ({ thread }) => [queryKeys.threads.activity(thread._id)],
  });
}

/** Nothing blank reaches the service, and nothing blank survives a rewrite. */
function sanitizeMoves(moves: readonly string[]): string[] {
  return moves.map((move) => move.trim()).filter((move) => move.length > 0);
}

/**
 * Complete the Next Move, promoting the front of Up Next when there is one.
 *
 * The Thread the caller is looking at carries both the move being completed and
 * the revision it was read at, and both travel with the command. A repeated click
 * therefore cannot complete a promoted move whose text matches the one already
 * completed, and a stale click comes back as a conflict — treated as stale data,
 * so the reads are restored and refetched rather than handed to the person to
 * resolve.
 */
export function useCompleteNextMove(): ApplicationMutationResult<
  { thread: Thread },
  CompleteNextMoveOutput
> {
  return useApplicationMutation<{ thread: Thread }, CompleteNextMoveOutput>({
    run: (client, { thread }) =>
      client.completeNextMove({
        threadId: thread._id,
        expectedNextMove: thread.nextMove ?? null,
        expectedRevision: thread.revision,
      }),
    affected: ({ thread }, cache) => [
      ...threadChangeKeys(cache, { threadId: thread._id }),
      queryKeys.threads.activity(thread._id),
    ],
    optimistic: (cache, { thread }) =>
      showThreadAttention(cache, thread._id, (cached) =>
        completeWhereUnchanged(cached, thread),
      ),
  });
}

/**
 * The completion, applied only where the Thread still looks the way the caller
 * read it. The Activity Log stays the service's to write: inventing an entry here
 * would mean inventing an ID and a time.
 */
function completeWhereUnchanged<
  T extends { nextMove?: string; upNext?: string[]; revision?: number },
>(cached: T, expected: Thread): T {
  if ((cached.nextMove ?? null) !== (expected.nextMove ?? null)) return cached;
  if (cached.revision !== undefined && cached.revision !== expected.revision) {
    return cached;
  }

  return completeNextMoveLocally(cached);
}
