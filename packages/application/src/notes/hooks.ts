import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type {
  ApplicationError,
  CommandAcknowledgement,
  Note,
  NoteId,
  NotePage,
} from "@vita-os/contracts";

import { useInfiniteQuery } from "@tanstack/react-query";
import { newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";

import { useApplicationClient } from "../application-client-provider";
import { useApplicationMutation } from "../cache/use-application-mutation";
import { useApplicationQuery } from "../cache/use-application-query";
import { queryKeys } from "../query-keys";
import {
  noteKeys,
  settleCapturedNote,
  showCapturedNote,
  showNoteEdit,
  showNoteLeavingInbox,
  showReopenedNote,
} from "./optimistic";

const DONE_PAGE_SIZE = 20;

/**
 * Every Open Note, newest first.
 *
 * Read whole rather than paged: an Open Note is one the person still has to deal
 * with, so this is the set they have agreed to look at. Done Notes grow without
 * limit and are paged instead.
 */
export function useOpenNotes(): UseQueryResult<Note[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.notes.open(),
    run: (client) => client.listOpenNotes(),
  });
}

/** How many Open Notes there are, for the navigation badge. */
export function useOpenNoteCount(): UseQueryResult<number, ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.notes.openCount(),
    run: (client) => client.countOpenNotes(),
  });
}

export type DoneNotesResult = UseInfiniteQueryResult<
  InfiniteData<NotePage>,
  ApplicationError
> & {
  notes: Note[];
};

/** Done Notes, newest completion first, a page at a time. */
export function useDoneNotes(limit = DONE_PAGE_SIZE): DoneNotesResult {
  const client = useApplicationClient();
  const query = useInfiniteQuery<
    NotePage,
    ApplicationError,
    InfiniteData<NotePage>,
    ReturnType<typeof queryKeys.notes.done>,
    string | undefined
  >({
    queryKey: queryKeys.notes.done(limit),
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const result = await client.getDoneNotePage({
        limit,
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
      });
      if (!result.ok) throw result.error;
      return result.value;
    },
    getNextPageParam: (page) => page.nextCursor,
  });

  return {
    ...query,
    notes: query.data?.pages.flatMap((page) => page.entries) ?? [],
  };
}

export interface CaptureNoteVariables {
  body: string;
  when?: number;
}

export function useCaptureNote(): ApplicationMutationResult<
  CaptureNoteVariables,
  Note,
  NoteId
> {
  return useApplicationMutation<CaptureNoteVariables, Note, NoteId>({
    run: (client, input) => client.createNote(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) => {
      const pendingId = newRecordId() as NoteId;
      const now = Date.now();
      showCapturedNote(cache, {
        _id: pendingId,
        body: input.body,
        ...(input.when === undefined ? {} : { when: input.when }),
        state: "open",
        createdAt: now,
        updatedAt: now,
      });
      return pendingId;
    },
    reconcile: (cache, note, _input, pendingId) => {
      if (pendingId === undefined) return;
      settleCapturedNote(cache, pendingId, note);
    },
  });
}

export function useUpdateNoteBody(): ApplicationMutationResult<
  { noteId: NoteId; body: string },
  Note
> {
  return useApplicationMutation<{ noteId: NoteId; body: string }, Note>({
    run: (client, input) => client.updateNoteBody(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      showNoteEdit(cache, input.noteId, { body: input.body }),
  });
}

/** The Attention Date, set or cleared. */
export function useUpdateNoteAttentionDate(): ApplicationMutationResult<
  { noteId: NoteId; when: number | null },
  Note
> {
  return useApplicationMutation<{ noteId: NoteId; when: number | null }, Note>({
    run: (client, input) => client.updateNoteAttentionDate(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      showNoteEdit(
        cache,
        input.noteId,
        input.when === null ? { when: undefined } : { when: input.when },
      ),
  });
}

export function useCompleteNote(): ApplicationMutationResult<
  { noteId: NoteId },
  Note
> {
  return useApplicationMutation<{ noteId: NoteId }, Note>({
    run: (client, input) => client.markNoteDone(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) => showNoteLeavingInbox(cache, input.noteId),
  });
}

/** Reopening needs the whole Note: it is not in the open list to rebuild from. */
export function useReopenNote(): ApplicationMutationResult<
  { note: Note },
  Note
> {
  return useApplicationMutation<{ note: Note }, Note>({
    run: (client, input) => client.markNoteOpen({ noteId: input.note._id }),
    affected: () => noteKeys(),
    optimistic: (cache, input) => showReopenedNote(cache, input.note),
  });
}

export function useDiscardNote(): ApplicationMutationResult<
  { noteId: NoteId },
  CommandAcknowledgement
> {
  return useApplicationMutation<{ noteId: NoteId }, CommandAcknowledgement>({
    run: (client, input) => client.removeNote(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) => showNoteLeavingInbox(cache, input.noteId),
  });
}
