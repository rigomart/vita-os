import type { Note } from "@vita-os/contracts";

import { useQueryClient } from "@tanstack/react-query";
import { isApplicationError } from "@vita-os/contracts";
import { decideCompleteNote } from "@vita-os/core";
import { format } from "date-fns";

import { clock } from "../lib/clock";
import { browserTimeZone } from "../lib/time-zone";
import {
  completeNoteKey,
  type CompleteNoteVariables,
  useCompleteNote as useCompleteNoteCommand,
} from "./hooks";

/**
 * Completing a repeating Note: it moves to its next occurrence. Resolves with
 * the Note as the service saved it, or `undefined` when a completion of this
 * Note is already in flight. That one names the occurrence on screen when it
 * was issued, so a second activation — from a card that moved and remounted,
 * or from the Note view — would otherwise complete the next one too.
 */
export function useCompleteNote() {
  const cache = useQueryClient();
  const complete = useCompleteNoteCommand();
  // Mutation state is marked synchronously before onMutate awaits cancelled reads.
  const pending = (note: Note) =>
    cache
      .getMutationCache()
      .findAll({ mutationKey: completeNoteKey, status: "pending" })
      .some(
        (mutation) =>
          (mutation.state.variables as CompleteNoteVariables | undefined)
            ?.noteId === note._id,
      );

  return async (note: Note): Promise<Note | undefined> => {
    if (note.followUp === undefined || pending(note)) return undefined;
    return complete.mutateAsync({
      noteId: note._id,
      expectedOccurrence: note.followUp,
      timeZone: browserTimeZone(),
      now: clock.now(),
    });
  };
}

/**
 * What Complete says on a repeating Note: where it goes back to, "Complete ·
 * back Dec 5". A date the rule refuses says only Complete.
 */
export function completeNoteLabel(
  note: Pick<Note, "followUp" | "repeat">,
  now: number,
): string {
  try {
    const next = decideCompleteNote(note, {
      timeZone: browserTimeZone(),
      now,
    }).followUp;
    return next === undefined
      ? "Complete"
      : `Complete · back ${format(next, "MMM d")}`;
  } catch {
    return "Complete";
  }
}

/**
 * The service refused because the Note is no longer what the screen showed:
 * it moved on elsewhere (`conflict`), or no longer repeats (`validation`, the
 * one rule completing checks). Its refused change is rolled back and the
 * Notes are read again, so the screen shows the Note as it now is.
 */
export function isStaleCompletion(error: unknown): boolean {
  return (
    isApplicationError(error) &&
    (error.code === "conflict" || error.code === "validation")
  );
}

export function completeNoteFailure(error: unknown): string {
  if (!isApplicationError(error)) {
    return "Could not complete the note. Please try again.";
  }
  if (error.code === "conflict") {
    return "This note changed elsewhere. It has been refreshed.";
  }
  if (error.code === "validation") return "This note no longer repeats.";
  return "Could not complete the note. Please try again.";
}
