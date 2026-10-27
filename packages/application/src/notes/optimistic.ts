import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Note, NoteId } from "@vita-os/contracts";
import type { NoteRepeatState } from "@vita-os/core";

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
 * Completed Notes (stored as Done), searched or not.
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
 * A change to a Note's date and Repeat, shown the way the service is about to
 * decide it: the same rule runs here, so clearing the date clears the Repeat
 * on screen too, and a weekly Repeat snaps the date the same way. A change
 * the rule would refuse leaves the Note as it is; the service's refusal then
 * rolls back the rest.
 */
export function showNoteDates(
  cache: QueryClient,
  noteId: NoteId,
  decide: (note: Note) => NoteRepeatState | null,
): void {
  const patch = (notes: Note[]) =>
    notes.map((note) =>
      note._id === noteId ? withNoteDates(note, decide) : note,
    );
  patchOpenNotes(cache, patch);
  patchPagedEntries<Note>(cache, queryKeys.notes.doneAll(), patch);
}

function withNoteDates(
  note: Note,
  decide: (note: Note) => NoteRepeatState | null,
): Note {
  let dates: NoteRepeatState | null;
  try {
    dates = decide(note);
  } catch {
    return note;
  }
  if (dates === null) return note;
  const { followUp: _followUp, repeat: _repeat, ...rest } = note;
  return { ...rest, ...dates };
}

/**
 * Taking a Note out of the Open Notes — completing it and discarding it both do
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
 * Reopening a Note puts it back on the Open Notes, which is why the caller
 * passes the whole record: a Completed Note was never in the open list to
 * rebuild it from. The completed pages drop it immediately while retaining the
 * service's pagination cursors.
 */
export function showReopenedNote(cache: QueryClient, note: Note): void {
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
