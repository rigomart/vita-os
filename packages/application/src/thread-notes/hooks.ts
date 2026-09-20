import type {
  InfiniteData,
  QueryClient,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type {
  ApplicationError,
  CommandAcknowledgement,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
  ThreadNotePage,
} from "@vita-os/contracts";

import { useInfiniteQuery } from "@tanstack/react-query";
import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";

import { useApplicationClient } from "../application-client-provider";
import { patchById, patchQuery, removeById } from "../cache/patch";
import { useApplicationMutation } from "../cache/use-application-mutation";
import { useOptionalApplicationQuery } from "../cache/use-application-query";
import { queryKeys } from "../query-keys";

const DONE_PAGE_SIZE = 20;

/**
 * A Thread's Open Notes, newest first. `null` means the Thread is not there — or
 * is not this person's, which reads the same.
 */
export function useThreadNotes(
  threadId: ThreadId,
): UseQueryResult<ThreadNote[] | null, ApplicationError> {
  return useOptionalApplicationQuery({
    queryKey: queryKeys.threadNotes.open(threadId),
    run: (client) => client.listOpenThreadNotes({ threadId }),
  });
}

export type DoneThreadNotesResult = UseInfiniteQueryResult<
  InfiniteData<ThreadNotePage>,
  ApplicationError
> & {
  notes: ThreadNote[];
};

/** A Thread's Done Notes, a bounded page at a time. */
export function useDoneThreadNotes(
  threadId: ThreadId,
  limit = DONE_PAGE_SIZE,
): DoneThreadNotesResult {
  const client = useApplicationClient();
  const query = useInfiniteQuery<
    ThreadNotePage,
    ApplicationError,
    InfiniteData<ThreadNotePage>,
    ReturnType<typeof queryKeys.threadNotes.done>,
    string | undefined
  >({
    queryKey: queryKeys.threadNotes.done(threadId, limit),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const result = await client.getDoneThreadNotePage({
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
    notes: query.data?.pages.flatMap((page) => page.entries) ?? [],
  };
}

function threadNoteKeys(threadId: ThreadId) {
  return [
    queryKeys.threadNotes.open(threadId),
    queryKeys.threadNotes.doneAll(threadId),
  ];
}

function patchOpenThreadNotes(
  cache: QueryClient,
  threadId: ThreadId,
  patch: (notes: ThreadNote[]) => ThreadNote[],
): void {
  patchQuery<ThreadNote[]>(cache, queryKeys.threadNotes.open(threadId), patch);
}

/**
 * Capturing a Note inside a Thread. It counts as Thread activity, so the reads
 * that show a Thread's recent activity are invalidated with it.
 */
export function useCaptureThreadNote(): ApplicationMutationResult<
  { threadId: ThreadId; body: string },
  ThreadNote,
  ThreadNoteId
> {
  return useApplicationMutation<
    { threadId: ThreadId; body: string },
    ThreadNote,
    ThreadNoteId
  >({
    run: (client, input) => client.createThreadNote(input),
    affected: (input) => threadNoteKeys(input.threadId),
    optimistic: (cache, input) => {
      const pendingId = newRecordId() as ThreadNoteId;
      const now = Date.now();
      patchOpenThreadNotes(cache, input.threadId, (notes) => [
        {
          _id: pendingId,
          body: input.body,
          state: "open",
          createdAt: now,
          updatedAt: now,
        },
        ...notes,
      ]);
      return pendingId;
    },
    reconcile: (cache, note, input, pendingId) => {
      if (pendingId === undefined) return;
      patchOpenThreadNotes(cache, input.threadId, (notes) =>
        notes.map((existing) => (existing._id === pendingId ? note : existing)),
      );
    },
    alsoInvalidate: () => [
      queryKeys.threads.open(),
      queryKeys.threads.details(),
    ],
  });
}

export function useUpdateThreadNoteBody(): ApplicationMutationResult<
  { threadId: ThreadId; threadNoteId: ThreadNoteId; body: string },
  ThreadNote
> {
  return useApplicationMutation<
    { threadId: ThreadId; threadNoteId: ThreadNoteId; body: string },
    ThreadNote
  >({
    run: (client, input) =>
      client.updateThreadNoteBody({
        threadNoteId: input.threadNoteId,
        body: input.body,
      }),
    affected: (input) => threadNoteKeys(input.threadId),
    optimistic: (cache, input) =>
      patchOpenThreadNotes(cache, input.threadId, (notes) =>
        patchById(notes, input.threadNoteId, { body: input.body }),
      ),
  });
}

export function useCompleteThreadNote(): ApplicationMutationResult<
  { threadId: ThreadId; threadNoteId: ThreadNoteId },
  ThreadNote
> {
  return useApplicationMutation<
    { threadId: ThreadId; threadNoteId: ThreadNoteId },
    ThreadNote
  >({
    run: (client, input) =>
      client.markThreadNoteDone({ threadNoteId: input.threadNoteId }),
    affected: (input) => threadNoteKeys(input.threadId),
    optimistic: (cache, input) =>
      patchOpenThreadNotes(cache, input.threadId, (notes) =>
        removeById(notes, input.threadNoteId),
      ),
  });
}

/**
 * Reopening a Thread Note. The caller passes the record because a Done Note was
 * never in the open list to rebuild it from.
 */
export function useReopenThreadNote(): ApplicationMutationResult<
  { threadId: ThreadId; note: ThreadNote },
  ThreadNote
> {
  return useApplicationMutation<
    { threadId: ThreadId; note: ThreadNote },
    ThreadNote
  >({
    run: (client, input) =>
      client.markThreadNoteOpen({ threadNoteId: input.note._id }),
    affected: (input) => threadNoteKeys(input.threadId),
    optimistic: (cache, input) =>
      patchOpenThreadNotes(cache, input.threadId, (notes) =>
        notes.some((existing) => existing._id === input.note._id)
          ? notes
          : [
              { ...input.note, state: "open", completedAt: undefined },
              ...notes,
            ],
      ),
  });
}

export function useDiscardThreadNote(): ApplicationMutationResult<
  { threadId: ThreadId; threadNoteId: ThreadNoteId },
  CommandAcknowledgement
> {
  return useApplicationMutation<
    { threadId: ThreadId; threadNoteId: ThreadNoteId },
    CommandAcknowledgement
  >({
    run: (client, input) =>
      client.removeThreadNote({ threadNoteId: input.threadNoteId }),
    affected: (input) => threadNoteKeys(input.threadId),
    optimistic: (cache, input) =>
      patchOpenThreadNotes(cache, input.threadId, (notes) =>
        removeById(notes, input.threadNoteId),
      ),
  });
}
