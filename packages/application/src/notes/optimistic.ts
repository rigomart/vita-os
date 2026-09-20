import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Note, NoteId } from "@vita-os/contracts";

import {
  insertNewestFirst,
  patchById,
  patchQuery,
  removeById,
} from "../cache/patch";
import { queryKeys } from "../query-keys";

/** Every read a Note command can touch. */
export function noteKeys(): QueryKey[] {
  return [
    queryKeys.notes.open(),
    queryKeys.notes.openCount(),
    queryKeys.notes.doneAll(),
  ];
}

/**
 * Every change to the cached Open Notes goes through here, membership changes and
 * in-place edits alike.
 *
 * The count is the length of the same list on the service — one index read two
 * ways — so it is derived from the patched list rather than counted up and down on
 * its own. With no cached list there is nothing to derive from, and the count is
 * left for the service, except where the change is knowable by itself (see
 * `showCapturedNote`).
 */
export function patchOpenNotes(
  cache: QueryClient,
  patch: (notes: Note[]) => Note[],
): void {
  const current = cache.getQueryData<Note[]>(queryKeys.notes.open());
  if (current === undefined) return;

  const next = patch(current);
  cache.setQueryData<Note[]>(queryKeys.notes.open(), next);
  patchQuery<number>(cache, queryKeys.notes.openCount(), () => next.length);
}

/**
 * Capturing a Note is the one membership change whose effect holds without the
 * list: it adds exactly one Open Note. That matters because the count feeds the
 * navigation badge while the list is only read by the Inbox, so a Note captured
 * from anywhere else would otherwise leave the badge frozen until the round trip
 * lands. Removals get no such fallback — whether the Note was in the Open Notes
 * at all cannot be known without them.
 */
export function showCapturedNote(cache: QueryClient, note: Note): void {
  if (cache.getQueryData<Note[]>(queryKeys.notes.open()) === undefined) {
    patchQuery<number>(
      cache,
      queryKeys.notes.openCount(),
      (count) => count + 1,
    );
    return;
  }

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
}

/**
 * Taking a Note out of the open Inbox — completing it and discarding it both do
 * this the same way, because the Open Notes read holds Open Notes only.
 */
export function showNoteLeavingInbox(cache: QueryClient, noteId: NoteId): void {
  patchOpenNotes(cache, (notes) => removeById(notes, noteId));
}

/**
 * Reopening a Note puts it back on the Open Notes, which is why the caller passes
 * the whole record: a Done Note was never in the open list to rebuild it from. The
 * Done pages are deliberately left alone, so for one round trip the Note shows in
 * both places until the service drops it from that page.
 */
export function showReopenedNote(cache: QueryClient, note: Note): void {
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
