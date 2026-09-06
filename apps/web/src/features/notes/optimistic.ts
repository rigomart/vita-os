import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedNote } from "@convex/lib/validators";
import type { OptimisticLocalStore } from "convex/browser";

import { api } from "@convex/_generated/api";

import {
  insertNoteIntoInbox,
  removeNoteFromInbox,
} from "@/features/notes/inbox";
import { patchById, patchQuery } from "@/features/shared/optimistic";

export {
  removeNoteFromInbox,
  updateNoteWhenInInbox,
} from "@/features/notes/inbox";

type Note = ProjectedNote;

export function updateNoteBodyInInbox<T extends Note>(
  notes: T[],
  id: Id<"tasks">,
  body: string,
): T[] {
  return patchById(notes, id, { body } as Partial<T>);
}

/**
 * Every patch to the cached Open Notes goes through here, membership changes
 * and in-place edits alike. `notes.count` is the length of `notes.list` on the
 * server — the same index read two ways — so the count is derived from the
 * patched list rather than counted up and down on its own. With no cached list
 * there is nothing to derive from, and the count is left for the server to
 * reconcile, except where the delta is knowable on its own (see
 * `optimisticallyAddToOpenNotes`).
 */
export function patchOpenNotes(
  localStore: OptimisticLocalStore,
  patch: (notes: Note[]) => Note[],
): void {
  const current = localStore.getQuery(api.notes.list, {});
  if (current === undefined) return;

  const next = patch(current);
  localStore.setQuery(api.notes.list, {}, next);
  patchQuery(localStore, api.notes.count, {}, () => next.length);
}

/**
 * Creating a Note is the one membership change whose delta holds without the
 * list: it adds exactly one Open Note. That matters because `notes.count`
 * feeds the app-wide Inbox badge while `notes.list` is only loaded by the
 * Inbox screen, so a Note created from anywhere else would otherwise leave the
 * badge frozen until the round-trip lands. Removals get no such fallback —
 * whether the Note was in the Open Notes at all can't be known without them.
 */
export function optimisticallyAddToOpenNotes(
  localStore: OptimisticLocalStore,
  note: Note,
): void {
  if (localStore.getQuery(api.notes.list, {}) === undefined) {
    patchQuery(localStore, api.notes.count, {}, (count) => count + 1);
    return;
  }

  patchOpenNotes(localStore, (notes) => [note, ...notes]);
}

/**
 * Shared cache update for taking a Note out of the open Inbox — completing
 * it and discarding it both do this the same way. `notes.list` is Open Notes
 * only, so either action removes the Note from that cache outright rather
 * than patching it in place.
 */
export function optimisticallyRemoveFromOpenNotes(
  localStore: OptimisticLocalStore,
  args: { id: Id<"tasks"> },
): void {
  patchOpenNotes(localStore, (notes) => removeNoteFromInbox(notes, args.id));
}

/**
 * Reopening a Note moves it off the `notes.listDone` page and back onto
 * `notes.list`, which is why the caller passes the whole document: a Done
 * Note was never in the open list to reconstruct it from. The paginated Done
 * cache is deliberately left alone, so for one round-trip the Note renders in
 * both places: back in the open list, and still under Completed until the
 * server drops it from that page.
 */
export function optimisticallyReopenNote(
  localStore: OptimisticLocalStore,
  note: Note,
): void {
  patchOpenNotes(localStore, (notes) =>
    notes.some((existing) => existing._id === note._id)
      ? notes
      : insertNoteIntoInbox(notes, {
          ...note,
          state: "open",
          completedAt: undefined,
        }),
  );
}
