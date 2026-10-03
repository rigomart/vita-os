import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Note, NoteId } from "@vita-os/contracts";

import {
  insertNewestFirst,
  patchById,
  patchPagedEntries,
  patchQuery,
  removeById,
} from "../cache/patch";
import { queryKeys } from "../query-keys";

/**
 * Every read a Note command can touch: the Open Notes, and every page of
 * Archived Notes (stored as Done), searched or not.
 */
export function noteKeys(): QueryKey[] {
  return [queryKeys.notes.open(), queryKeys.notes.doneAll()];
}

/**
 * Every change to the cached Open Notes goes through here, membership changes
 * and in-place edits alike. The Notes filter's count is this list's length, so
 * it follows without a patch of its own.
 */
export function patchOpenNotes(
  cache: QueryClient,
  patch: (notes: Note[]) => Note[],
): void {
  patchQuery<Note[]>(cache, queryKeys.notes.open(), patch);
}

export function showCapturedNote(cache: QueryClient, note: Note): void {
  patchOpenNotes(cache, (notes) => [note, ...notes]);
}

export function settleCapturedNote(
  cache: QueryClient,
  pendingId: NoteId,
  note: Note,
): void {
  patchOpenNotes(cache, (notes) =>
    notes.map((existing) => (existing._id === pendingId ? note : existing)),
  );
}

export function showNoteEdit(
  cache: QueryClient,
  noteId: NoteId,
  patch: Partial<Note>,
): void {
  patchOpenNotes(cache, (notes) => patchById(notes, noteId, patch));
  patchPagedEntries<Note>(cache, queryKeys.notes.doneAll(), (notes) =>
    patchById(notes, noteId, patch),
  );
}

/**
 * Taking a Note out of the Open Notes — archiving it and discarding it both do
 * this the same way, because that read holds Open Notes only.
 */
export function showNoteLeavingOpenNotes(
  cache: QueryClient,
  noteId: NoteId,
): void {
  patchOpenNotes(cache, (notes) => removeById(notes, noteId));
  patchPagedEntries<Note>(cache, queryKeys.notes.doneAll(), (notes) =>
    removeById(notes, noteId),
  );
}

/**
 * Unarchiving a Note puts it back on the Open Notes, which is why the caller
 * passes the whole record: an Archived Note was never in the open list to
 * rebuild it from. The archived pages drop it immediately while retaining the
 * service's pagination cursors.
 */
export function showUnarchivedNote(cache: QueryClient, note: Note): void {
  patchPagedEntries<Note>(cache, queryKeys.notes.doneAll(), (notes) =>
    removeById(notes, note._id),
  );
  patchOpenNotes(cache, (notes) =>
    notes.some((existing) => existing._id === note._id)
      ? notes
      : insertNewestFirst(
          notes,
          { ...note, state: "open", completedAt: undefined },
          (candidate) => candidate.createdAt,
        ),
  );
}
