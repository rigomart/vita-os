import type { Note } from "@vita-os/contracts";

function startOfDayMs(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** An Attention Date that has arrived, by the day rather than by the minute. */
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
