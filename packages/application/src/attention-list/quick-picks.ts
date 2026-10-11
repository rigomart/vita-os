import { timeOfDay, withTimeOfDay } from "@vita-os/core";
import {
  addDays,
  addMonths,
  isSaturday,
  isSunday,
  nextMonday,
  nextSaturday,
  startOfDay,
} from "date-fns";

export interface QuickPick {
  label: string;
  /** Local midnight of the day it lands on. */
  day: number;
}

/**
 * The days a When is most often set to, from today. On a Sunday the weekend
 * is next Saturday's, and says so. A pick that lands on an earlier one's day
 * is left out: on a Saturday this weekend is today, and on a Sunday next week
 * is tomorrow.
 */
export function quickPicks(now: number): QuickPick[] {
  const today = startOfDay(now);
  const picks = [
    { label: "Today", day: today },
    { label: "Tomorrow", day: addDays(today, 1) },
    {
      label: isSunday(today) ? "Next weekend" : "This weekend",
      day: isSaturday(today) ? today : nextSaturday(today),
    },
    { label: "Next week", day: nextMonday(today) },
    { label: "In 2 weeks", day: addDays(today, 14) },
    { label: "In a month", day: addMonths(today, 1) },
  ].map(({ label, day }) => ({ label, day: day.getTime() }));
  return picks.filter(
    (pick, index) =>
      picks.findIndex((other) => other.day === pick.day) === index,
  );
}

/** `day`, at the time of day `current` already carries. */
export function onDay(day: number, current: number | undefined): number {
  return withTimeOfDay(
    day,
    current === undefined ? undefined : timeOfDay(current),
  );
}

/** The times offered as chips, one click each; Other… types the rest. */
export const CHIP_TIMES = ["09:00", "12:00", "15:00", "18:00"] as const;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The times, as `HH:mm`, that a partly typed one could be, likeliest first:
 * "7" is 7 AM or 7 PM, "7:3" is 7:30, "745p" is 7:45 PM, "1930" is 7:30 PM.
 * An hour without AM or PM offers both rather than guessing: 1 to 6 afternoon
 * first, 7 to 11 morning first. Midnight is never offered: a When at midnight
 * reads as a day alone (ADR 0027).
 */
export function timeSuggestions(text: string): string[] {
  const value = text.trim().toLowerCase().replace(/\s+/g, "");
  if (value === "noon") return ["12:00"];
  const match = /^(\d{1,4})(?::(\d{0,2}))?(a|am|p|pm)?$/.exec(value);
  if (!match) return [];
  const digits = match[1]!;
  // Without a colon, 745 is 7:45 and 1930 is 19:30.
  const split = match[2] === undefined && digits.length > 2;
  if (!split && digits.length > 2) return [];
  const hours = Number(split ? digits.slice(0, -2) : digits);
  const typed = split ? digits.slice(-2) : (match[2] ?? "");
  const minutes = typed === "" ? 0 : Number(typed.padEnd(2, "0"));
  const meridiem = match[3]?.[0];
  if (minutes > 59) return [];

  let candidates: number[];
  if (meridiem) {
    if (hours < 1 || hours > 12) return [];
    candidates = [(hours % 12) + (meridiem === "p" ? 12 : 0)];
  } else if (hours === 0 || hours > 12) {
    if (hours > 23) return [];
    candidates = [hours];
  } else if (hours === 12) {
    candidates = [12];
  } else {
    candidates = hours <= 6 ? [hours + 12, hours] : [hours, hours + 12];
  }
  return candidates
    .map((hour) => `${pad(hour)}:${pad(minutes)}`)
    .filter((time) => time !== "00:00");
}
