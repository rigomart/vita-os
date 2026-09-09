import { format } from "date-fns";

export const DAY = 24 * 60 * 60 * 1000;

/**
 * A date as a token, never a sentence: −6d · Today · Tue · 12d · Mar 4.
 *
 * The board is dense enough that a phrase on every card reads as noise, and
 * the column a token sits in already says roughly when — so the token only has
 * to say exactly when, in about four characters.
 */
export function dateToken(timestamp: number, currentDate: number) {
  const difference = dayDelta(timestamp, currentDate);
  if (difference < 0) return `−${-difference}d`;
  if (difference === 0) return "Today";
  if (difference <= 6) return format(new Date(timestamp), "EEE");
  if (difference <= 27) return `${difference}d`;
  return format(new Date(timestamp), "MMM d");
}

/** How loudly a date reads: late shouts, this week speaks, later murmurs. */
export function dateToneClassName(timestamp: number, currentDate: number) {
  const difference = dayDelta(timestamp, currentDate);
  if (difference < 0) return "text-condition-attention";
  if (difference === 0) return "text-foreground";
  if (difference <= 6) return "text-foreground/60";
  return "text-muted-foreground/45";
}

/** Whole local days from today to `timestamp` (negative means past). */
export function dayDelta(timestamp: number, currentDate: number) {
  return Math.round(
    (startOfLocalDay(timestamp) - startOfLocalDay(currentDate)) / DAY,
  );
}

export function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}
