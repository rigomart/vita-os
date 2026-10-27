import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type {
  ApplicationError,
  CommandAcknowledgement,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";

import {
  changeRecords,
  patchById,
  patchQuery,
  removeById,
} from "../cache/patch";
import { afterUndoWindow } from "../cache/undo-window";
import { useApplicationMutation } from "../cache/use-application-mutation";
import { useOptionalApplicationQuery } from "../cache/use-application-query";
import { clock } from "../lib/clock";
import { queryKeys } from "../query-keys";

/**
 * A Thread's Notes, newest first. `null` means the Thread is not there — or
 * is not this person's, which reads the same.
 */
export function useThreadNotes(
  threadId: ThreadId,
): UseQueryResult<ThreadNote[] | null, ApplicationError> {
  return useOptionalApplicationQuery({
    queryKey: queryKeys.threadNotes.list(threadId),
    run: (client) => client.listThreadNotes({ threadId }),
  });
}

function threadNoteKeys(threadId: ThreadId) {
  return [queryKeys.threadNotes.list(threadId)];
}

function patchThreadNotes(
  cache: QueryClient,
  threadId: ThreadId,
  patch: (notes: ThreadNote[]) => ThreadNote[],
): void {
  patchQuery<ThreadNote[]>(cache, queryKeys.threadNotes.list(threadId), patch);
}

/**
 * A Thread Note shown before the service answers, newest first. One already
 * there by its ID is left alone, so showing it again never doubles it.
 */
export function showThreadNote(
  cache: QueryClient,
  threadId: ThreadId,
  note: ThreadNote,
): void {
  patchThreadNotes(cache, threadId, (notes) =>
    notes.some((existing) => existing._id === note._id)
      ? notes
      : [note, ...notes],
  );
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
      const now = clock.now();
      const rollback = changeRecords<ThreadNote>(
        cache,
        threadNoteKeys(input.threadId),
        [pendingId],
        [],
        () =>
          showThreadNote(cache, input.threadId, {
            _id: pendingId,
            body: input.body,
            createdAt: now,
            updatedAt: now,
          }),
      );
      return { local: pendingId, ...rollback };
    },
    reconcile: (cache, note, input, pendingId) => {
      if (pendingId === undefined) return;
      patchThreadNotes(cache, input.threadId, (notes) =>
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
      changeRecords<ThreadNote>(
        cache,
        threadNoteKeys(input.threadId),
        [input.threadNoteId],
        ["body"],
        () =>
          patchThreadNotes(cache, input.threadId, (notes) =>
            patchById(notes, input.threadNoteId, { body: input.body }),
          ),
      ),
  });
}

export function useDiscardThreadNote(): ApplicationMutationResult<
  {
    threadId: ThreadId;
    threadNoteId: ThreadNoteId;
    undoWindow?: () => Promise<boolean>;
  },
  CommandAcknowledgement
> {
  return useApplicationMutation<
    {
      threadId: ThreadId;
      threadNoteId: ThreadNoteId;
      undoWindow?: () => Promise<boolean>;
    },
    CommandAcknowledgement
  >({
    run: async (client, input) => {
      await afterUndoWindow(input.undoWindow);
      return client.removeThreadNote({ threadNoteId: input.threadNoteId });
    },
    affected: (input) => threadNoteKeys(input.threadId),
    optimistic: (cache, input) =>
      changeRecords<ThreadNote>(
        cache,
        threadNoteKeys(input.threadId),
        [input.threadNoteId],
        ["body"],
        () =>
          patchThreadNotes(cache, input.threadId, (notes) =>
            removeById(notes, input.threadNoteId),
          ),
      ),
  });
}
