import type { Repeat } from "@vita-os/contracts";

import { snapTaskDate, startOfLocalDay } from "@vita-os/core";
import { format } from "date-fns";

import { timeToken } from "./date-parts";

/** Sunday is weekday 0, as a Repeat stores it and the calendar starts its week. */
export const WEEKDAYS = [
  { day: 0, name: "Sunday", short: "Sun", letter: "S" },
  { day: 1, name: "Monday", short: "Mon", letter: "M" },
  { day: 2, name: "Tuesday", short: "Tue", letter: "T" },
  { day: 3, name: "Wednesday", short: "Wed", letter: "W" },
  { day: 4, name: "Thursday", short: "Thu", letter: "T" },
  { day: 5, name: "Friday", short: "Fri", letter: "F" },
  { day: 6, name: "Saturday", short: "Sat", letter: "S" },
] as const;

/** The longest every-N-days rhythm a Repeat holds. */
export const MAX_REPEAT_DAYS = 365;

/**
 * The picker's Repeat choice while it is open. Every N days keeps its own
 * choice even at one day, and weekly may briefly hold no day while the person
 * is changing which ones; neither is a stored Repeat until it is valid.
 */
export type RepeatDraft =
  | { mode: "never" }
  | { mode: "daily" }
  | { mode: "everyN"; every: number }
  | { mode: "weekly"; weekdays: number[] };

export function repeatDraft(repeat: Repeat | undefined): RepeatDraft {
  if (repeat === undefined) return { mode: "never" };
  if (repeat.kind === "weekly") {
    return { mode: "weekly", weekdays: [...repeat.weekdays] };
  }
  return repeat.every === 1
    ? { mode: "daily" }
    : { mode: "everyN", every: repeat.every };
}

/** The Repeat a draft stands for: `null` for none, `undefined` while it is incomplete. */
export function draftRepeat(draft: RepeatDraft): Repeat | null | undefined {
  switch (draft.mode) {
    case "never":
      return null;
    case "daily":
      return { kind: "days", every: 1 };
    case "everyN":
      return { kind: "days", every: draft.every };
    case "weekly":
      return draft.weekdays.length === 0
        ? undefined
        : {
            kind: "weekly",
            weekdays: [...draft.weekdays].sort((a, b) => a - b),
          };
  }
}

export function sameRepeat(
  a: Repeat | null | undefined,
  b: Repeat | null | undefined,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function weekdayNames(weekdays: readonly number[]): string {
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAYS[day]!.short)
    .join(", ");
}

/** The rhythm in a few words, for the glyph's label: "Repeats every 3 days". */
export function repeatLabel(repeat: Repeat): string {
  if (repeat.kind === "weekly") {
    return `Repeats weekly on ${weekdayNames(repeat.weekdays)}`;
  }
  return repeat.every === 1
    ? "Repeats daily"
    : `Repeats every ${repeat.every} days`;
}

const dayName = (when: number) => format(when, "EEE, MMM d");

/**
 * The picker's one line under its Repeat choices: what the Task will do, from
 * which day, at what time. A weekly choice that moves the date says where to,
 * before it happens.
 */
export function repeatSummary(
  when: number | undefined,
  draft: RepeatDraft,
  timeZone: string,
): string {
  if (when === undefined) {
    return "No date. The Task stays in the list without one, and a repeat needs a date.";
  }
  const time = timeToken(when);
  const at = time === undefined ? "" : ` at ${time}`;
  const from = dayName(when);

  switch (draft.mode) {
    case "never":
      return `Once, on ${from}${at}.`;
    case "daily":
      return `Every day${at}, from ${from}.`;
    case "everyN":
      return draft.every === 1
        ? `Every day${at}, from ${from}.`
        : `Every ${draft.every} days${at}, from ${from}.`;
    case "weekly": {
      if (draft.weekdays.length === 0) return "Choose at least one day.";
      const names = weekdayNames(draft.weekdays);
      const snapped = snapTaskDate(
        when,
        { kind: "weekly", weekdays: draft.weekdays },
        timeZone,
      );
      return startOfLocalDay(snapped) === startOfLocalDay(when)
        ? `Weekly on ${names}${at}, from ${from}.`
        : `Weekly on ${names}${at}. The date moves to ${dayName(snapped)}, the first chosen day.`;
    }
  }
}
