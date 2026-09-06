import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedNote } from "@convex/lib/validators";

import { patchById, removeById } from "@/features/shared/optimistic";

type Note = ProjectedNote;

function startOfDayMs(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isNoteWhenDue(
  when: number | undefined,
  referenceDate: number,
): boolean {
  if (when === undefined) {
    return false;
  }

  return startOfDayMs(when) <= startOfDayMs(referenceDate);
}

export function isNoteWhenEmphasized(
  note: Pick<Note, "state" | "when">,
  referenceDate: number,
): boolean {
  if (note.state === "done") {
    return false;
  }

  return isNoteWhenDue(note.when, referenceDate);
}

/**
 * Removes a Note from the open Inbox list. Used both when discarding a Note
 * and when completing one: `notes.list` holds Open Notes only, so a Note
 * that's done no longer belongs in this cache at all — it lives on the
 * separate `notes.listDone` page instead.
 */
export function removeNoteFromInbox<T extends Note>(
  notes: T[],
  id: Id<"tasks">,
): T[] {
  return removeById(notes, id);
}

/**
 * Puts a Note back into the open Inbox list, at the position the server would
 * give it: `notes.list` reads the `by_user_inbox` index in descending order,
 * so newest `createdAt` first, ties broken by `_creationTime`.
 */
export function insertNoteIntoInbox<T extends Note>(notes: T[], note: T): T[] {
  const index = notes.findIndex((existing) => sortsBefore(note, existing));
  if (index === -1) return [...notes, note];

  return [...notes.slice(0, index), note, ...notes.slice(index)];
}

function sortsBefore(note: Note, other: Note): boolean {
  return note.createdAt === other.createdAt
    ? note._creationTime > other._creationTime
    : note.createdAt > other.createdAt;
}

export function updateNoteWhenInInbox<T extends Note>(
  notes: T[],
  id: Id<"tasks">,
  when: number | undefined,
): T[] {
  return patchById(notes, id, { when } as Partial<T>);
}
