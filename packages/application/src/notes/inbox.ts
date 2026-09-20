import type { Note } from "@vita-os/contracts";

function startOfDayMs(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** An Attention Date that has arrived, by the day rather than by the minute. */
export function isNoteWhenDue(
  attentionDate: number | undefined,
  referenceDate: number,
): boolean {
  if (attentionDate === undefined) {
    return false;
  }

  return startOfDayMs(attentionDate) <= startOfDayMs(referenceDate);
}

/**
 * Whether a Note's Attention Date should draw the eye.
 *
 * A Done Note never does, however overdue it was: it has already been dealt
 * with.
 */
export function isNoteWhenEmphasized(
  note: Pick<Note, "state" | "attentionDate">,
  referenceDate: number,
): boolean {
  if (note.state === "done") {
    return false;
  }

  return isNoteWhenDue(note.attentionDate, referenceDate);
}
