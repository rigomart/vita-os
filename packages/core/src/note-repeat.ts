import type { Repeat } from "@vita-os/contracts";

import { ValidationError } from "./errors";
import {
  movedRepeat,
  nextTaskDate,
  requireRepeat,
  requireTimeZone,
  snapTaskDate,
} from "./task-repeat";
import { requireTaskDate } from "./tasks";

/**
 * A Standalone Note's Follow-up date and the Repeat it may carry. The rules
 * are a Task date's (ADR 0041): weekly and monthly Repeats snap and move the
 * same way, and the next occurrence is the same.
 *
 * Every rule answers with the Note's whole new date and Repeat, so a caller
 * writes both together. A Repeat without a date reads as no Repeat.
 */
export interface NoteRepeatState {
  followUp?: number;
  repeat?: Repeat;
}

function currentRepeat(note: NoteRepeatState): Repeat | undefined {
  return note.followUp === undefined || note.repeat === undefined
    ? undefined
    : requireRepeat(note.repeat);
}

/**
 * Set, change or (with `null`) clear the date; clearing it clears the Repeat.
 * A weekly Note's new date snaps to a chosen weekday in the zone; a monthly
 * Note's Repeat moves to the new date's day of month. The zone may be absent
 * only where no calendar date is computed.
 */
export function decideSetNoteFollowUp(
  note: NoteRepeatState,
  followUp: number | null,
  timeZone?: string,
): NoteRepeatState {
  if (timeZone !== undefined) requireTimeZone(timeZone);
  if (followUp === null) return {};
  let date = requireTaskDate(followUp);
  let repeat = currentRepeat(note);
  if (repeat?.kind === "weekly") {
    date = requireTaskDate(
      snapTaskDate(date, repeat, requireTimeZone(timeZone)),
    );
  }
  if (repeat?.kind === "monthly" && date !== note.followUp) {
    repeat = movedRepeat(
      repeat,
      note.followUp,
      date,
      requireTimeZone(timeZone),
    );
  }
  return { followUp: date, ...(repeat === undefined ? {} : { repeat }) };
}

/**
 * Set, change or (with `null`) clear the Repeat. A Repeat needs a date;
 * weekly and monthly choices snap it forward to their first day, keeping the
 * wall time.
 */
export function decideSetNoteRepeat(
  note: NoteRepeatState,
  repeat: Repeat | null,
  timeZone: string,
): NoteRepeatState {
  requireTimeZone(timeZone);
  if (note.followUp === undefined) {
    if (repeat === null) return {};
    throw new ValidationError("A Repeat requires a date");
  }
  if (repeat === null) return { followUp: note.followUp };
  const rule = requireRepeat(repeat);
  return {
    followUp: requireTaskDate(
      snapTaskDate(requireTaskDate(note.followUp), rule, timeZone),
    ),
    repeat: rule,
  };
}

/**
 * A new Note's date and Repeat, decided as if the Repeat were set right after
 * the date: it needs the date and a zone, and weekly and monthly snap it.
 */
export function decideNewNote(
  note: NoteRepeatState,
  timeZone?: string,
): NoteRepeatState {
  if (note.repeat === undefined) {
    return note.followUp === undefined
      ? {}
      : { followUp: requireTaskDate(note.followUp) };
  }
  return decideSetNoteRepeat(
    note.followUp === undefined ? {} : { followUp: note.followUp },
    note.repeat,
    requireTimeZone(timeZone),
  );
}

/**
 * Completing a repeating Note moves it to its next occurrence: missed ones
 * collapse into the first not before today. It records nothing.
 */
export function decideCompleteNote(
  note: NoteRepeatState,
  clock: { timeZone: string; now: number },
): NoteRepeatState {
  const repeat = currentRepeat(note);
  if (repeat === undefined || note.followUp === undefined) {
    throw new ValidationError("Only a repeating Note can be completed");
  }
  return {
    followUp: requireTaskDate(
      nextTaskDate(
        requireTaskDate(note.followUp),
        repeat,
        requireTimeZone(clock.timeZone),
        clock.now,
      ),
    ),
    repeat,
  };
}
