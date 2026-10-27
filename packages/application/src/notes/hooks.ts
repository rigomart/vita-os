import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ApplicationError,
  CommandAcknowledgement,
  CreateNoteInput,
  Note,
  NoteId,
  Repeat,
} from "@vita-os/contracts";

import {
  boundNoteSearch,
  decideCompleteNote,
  decideSetNoteFollowUp,
  decideSetNoteRepeat,
  newRecordId,
} from "@vita-os/core";

import type { ApplicationMutationResult } from "../cache/use-application-mutation";
import type { PagedResult } from "../cache/use-paged-application-query";

import { changeRecords } from "../cache/patch";
import { afterUndoWindow } from "../cache/undo-window";
import { useApplicationMutation } from "../cache/use-application-mutation";
import { useApplicationQuery } from "../cache/use-application-query";
import { usePagedApplicationQuery } from "../cache/use-paged-application-query";
import { clock } from "../lib/clock";
import { queryKeys } from "../query-keys";
import {
  noteKeys,
  settleCapturedNote,
  showCapturedNote,
  showNoteDates,
  showNoteEdit,
  showNoteLeavingOpenNotes,
  showReopenedNote,
} from "./optimistic";

const COMPLETED_PAGE_SIZE = 20;

/**
 * Every Open Note, newest first.
 *
 * Read whole rather than paged: an Open Note is one the person still has to deal
 * with, so this is the set they have agreed to look at. Completed Notes grow
 * without limit and are paged instead.
 */
export function useOpenNotes(): UseQueryResult<Note[], ApplicationError> {
  return useApplicationQuery({
    queryKey: queryKeys.notes.open(),
    run: (client) => client.listOpenNotes(),
  });
}

export type CompletedNotesResult = PagedResult<Note> & {
  /** The same entries, named for what they are on this surface. */
  notes: Note[];
};

/**
 * Completed Notes, most recently completed first: one bounded page, narrowed on
 * the service to the bodies containing every word of `query`. The service
 * stores them as Done.
 */
export function useCompletedNotes(
  options: { query?: string; limit?: number; enabled?: boolean } = {},
): CompletedNotesResult {
  const limit = options.limit ?? COMPLETED_PAGE_SIZE;
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

export type CaptureNoteVariables = CreateNoteInput;

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
      const now = clock.now();
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
            ...(input.repeat === undefined ? {} : { repeat: input.repeat }),
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

/**
 * The Follow-up date, set or cleared. Clearing it clears its Repeat; a weekly
 * Repeat snaps a new date to a chosen day, in `timeZone`.
 */
export function useUpdateNoteFollowUp(): ApplicationMutationResult<
  { noteId: NoteId; followUp: number | null; timeZone: string },
  Note
> {
  return useApplicationMutation<
    { noteId: NoteId; followUp: number | null; timeZone: string },
    Note
  >({
    run: (client, input) => client.updateNoteFollowUp(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      changeRecords<Note>(
        cache,
        noteKeys(),
        [input.noteId],
        ["followUp", "repeat"],
        () =>
          showNoteDates(cache, input.noteId, (note) =>
            decideSetNoteFollowUp(note, input.followUp, input.timeZone),
          ),
      ),
  });
}

/** A Standalone Note's Repeat, set or (with `null`) cleared. It needs a date. */
export function useSetNoteRepeat(): ApplicationMutationResult<
  { noteId: NoteId; repeat: Repeat | null; timeZone: string },
  Note
> {
  return useApplicationMutation<
    { noteId: NoteId; repeat: Repeat | null; timeZone: string },
    Note
  >({
    run: (client, input) => client.setNoteRepeat(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      changeRecords<Note>(
        cache,
        noteKeys(),
        [input.noteId],
        ["followUp", "repeat"],
        () =>
          showNoteDates(cache, input.noteId, (note) =>
            decideSetNoteRepeat(note, input.repeat, input.timeZone),
          ),
      ),
  });
}

/**
 * Completing names the occurrence the person acted on: the date the Note
 * showed then. A Note that has moved on since — a duplicate activation behind
 * the first, or a change from elsewhere — is not moved again here, and the
 * service refuses it. The zone and the current time are taken once, when the
 * command is issued, so optimism computes the same next date as the service.
 */
export interface CompleteNoteVariables {
  noteId: NoteId;
  expectedOccurrence: number;
  timeZone: string;
  now: number;
}

export const completeNoteKey = ["complete-note"] as const;

/** A repeating Note moves to its next occurrence; nothing is recorded. */
export function useCompleteNote(): ApplicationMutationResult<
  CompleteNoteVariables,
  Note
> {
  return useApplicationMutation<CompleteNoteVariables, Note>({
    mutationKey: completeNoteKey,
    run: (client, { now: _now, ...input }) => client.completeNote(input),
    affected: () => noteKeys(),
    optimistic: (cache, input) =>
      changeRecords<Note>(
        cache,
        noteKeys(),
        [input.noteId],
        ["followUp", "repeat"],
        () =>
          showNoteDates(cache, input.noteId, (note) =>
            note.followUp === input.expectedOccurrence
              ? decideCompleteNote(note, input)
              : null,
          ),
      ),
  });
}

/** Completing is the stored Done state: the Note leaves the board for History. */
export function useMarkNoteDone(): ApplicationMutationResult<
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

/** Reopening needs the whole Note: it is not in the open list to rebuild from. */
export function useMarkNoteOpen(): ApplicationMutationResult<
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
        () => showReopenedNote(cache, input.note),
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
