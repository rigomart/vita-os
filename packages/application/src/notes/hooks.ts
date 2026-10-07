import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ApplicationError,
  CommandAcknowledgement,
  Note,
  NoteId,
} from "@vita-os/contracts";

import { boundNoteSearch, newRecordId } from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";
import type { PagedResult } from "../cache/use-paged-application-query";

import { changeRecords } from "../cache/patch";
import { afterUndoWindow } from "../cache/undo-window";
import { useApplicationMutation } from "../cache/use-application-mutation";
import { useApplicationQuery } from "../cache/use-application-query";
import { usePagedApplicationQuery } from "../cache/use-paged-application-query";
import { queryKeys } from "../query-keys";
import {
  noteKeys,
  settleCapturedNote,
  showCapturedNote,
  showNoteEdit,
  showNoteLeavingOpenNotes,
  showUnarchivedNote,
} from "./optimistic";

const ARCHIVED_PAGE_SIZE = 20;

/**
 * Every Open Note, newest first.
 *
 * Read whole rather than paged: an Open Note is one the person still has to deal
 * with, so this is the set they have agreed to look at. Archived Notes grow
 * without limit and are paged instead.
 */
export function useOpenNotes(): UseQueryResult<Note[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.notes.open(),
    run: (client) => client.listOpenNotes(),
  });
}

export type ArchivedNotesResult = PagedResult<Note> & {
  /** The same entries, named for what they are on this surface. */
  notes: Note[];
};

/**
 * Archived Notes, most recently archived first: one bounded page, narrowed on
 * the service to the bodies containing every word of `query`. The service
 * stores them as Done.
 */
export function useArchivedNotes(
  options: { query?: string; limit?: number; enabled?: boolean } = {},
): ArchivedNotesResult {
  const limit = options.limit ?? ARCHIVED_PAGE_SIZE;
  const query = boundNoteSearch(options.query ?? "");
  const page = usePagedApplicationQuery<Note>({
    queryKey: queryKeys.notes.done(limit, query),
    run: (client, cursor) =>
      client.getDoneNotePage({
        limit,
        ...(query === "" ? {} : { query }),
        ...(cursor === undefined ? {} : { cursor }),
      }),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    keepPrevious: true,
  });

  return { ...page, notes: page.entries };
}

export interface CaptureNoteVariables {
  body: string;
  followUp?: number;
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
      const rollback = changeRecords<Note>(
        cache,
        noteKeys(),
        [pendingId],
        [],
        () =>
          showCapturedNote(cache, {
            _id: pendingId,
            body: input.body,
            ...(input.followUp === undefined
              ? {}
              : { followUp: input.followUp }),
            state: "open",
            createdAt: now,
            updatedAt: now,
          }),
      );
      return { local: pendingId, ...rollback };
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
      changeRecords<Note>(cache, noteKeys(), [input.noteId], ["body"], () =>
        showNoteEdit(cache, input.noteId, { body: input.body }),
      ),
  });
}

/** The Follow-up date, set or cleared. */
export function useUpdateNoteFollowUp(): ApplicationMutationResult<
  { noteId: NoteId; followUp: number | null },
  Note
> {
  return useApplicationMutation<
    { noteId: NoteId; followUp: number | null },
    Note
  >({
    run: (client, input) => client.updateNoteFollowUp(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      changeRecords<Note>(cache, noteKeys(), [input.noteId], ["followUp"], () =>
        showNoteEdit(
          cache,
          input.noteId,
          input.followUp === null
            ? { followUp: undefined }
            : { followUp: input.followUp },
        ),
      ),
  });
}

/** Archiving is the stored Done state: the Note leaves the board for History. */
export function useArchiveNote(): ApplicationMutationResult<
  { noteId: NoteId },
  Note
> {
  return useApplicationMutation<{ noteId: NoteId }, Note>({
    run: (client, input) => client.markNoteDone(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      changeRecords<Note>(cache, noteKeys(), [input.noteId], [], () =>
        showNoteLeavingOpenNotes(cache, input.noteId),
      ),
  });
}

/** Unarchiving needs the whole Note: it is not in the open list to rebuild from. */
export function useUnarchiveNote(): ApplicationMutationResult<
  { note: Note },
  Note
> {
  return useApplicationMutation<{ note: Note }, Note>({
    run: (client, input) => client.markNoteOpen({ noteId: input.note._id }),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      changeRecords<Note>(
        cache,
        noteKeys(),
        [input.note._id],
        ["state", "completedAt"],
        () => showUnarchivedNote(cache, input.note),
      ),
  });
}

export function useDiscardNote(): ApplicationMutationResult<
  { noteId: NoteId; undoWindow?: () => Promise<boolean> },
  CommandAcknowledgement
> {
  return useApplicationMutation<
    { noteId: NoteId; undoWindow?: () => Promise<boolean> },
    CommandAcknowledgement
  >({
    run: async (client, input) => {
      await afterUndoWindow(input.undoWindow);
      return client.removeNote({ noteId: input.noteId });
    },
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      changeRecords<Note>(cache, noteKeys(), [input.noteId], [], () =>
        showNoteLeavingOpenNotes(cache, input.noteId),
      ),
  });
}
