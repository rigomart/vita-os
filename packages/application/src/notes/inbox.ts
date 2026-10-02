import type { Note } from "@vita-os/contracts";

function startOfDayMs(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** An Follow-up date that has arrived, by the day rather than by the minute. */
export function isNoteWhenDue(
  followUp: number | undefined,
  referenceDate: number,
): boolean {
  if (followUp === undefined) {
    return false;
  }

  return startOfDayMs(followUp) <= startOfDayMs(referenceDate);
}

/**
 * Whether a Note's Follow-up date should draw the eye.
 *
 * A Done Note never does, however overdue it was: it has already been dealt
 * with.
 */
export function isNoteWhenEmphasized(
  note: Pick<Note, "state" | "followUp">,
  referenceDate: number,
): boolean {
  if (note.state === "done") {
    return false;
  }

  return isNoteWhenDue(note.followUp, referenceDate);
}
