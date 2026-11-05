import {
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameYear,
  subDays,
} from "date-fns";

/** Days without a line before the Activity Log reads the gap as quiet. */
export const QUIET_DAYS = 21;

/** Calendar days from `older` to `newer`, as the day headings count them. */
export function daysBetween(newer: number, older: number) {
  return differenceInCalendarDays(newer, older);
}

/** A span of days in words, each unit rounded: days under 14, weeks to 48 days, months to 350, then years. */
export function spanWords(days: number) {
  if (days < 14) return days === 1 ? "1 day" : `${days} days`;
  if (days < 49) return `${Math.round(days / 7)} weeks`;
  if (days <= 350) return `${Math.round(days / 30.44)} months`;
  const years = Math.round(days / 365.25);
  return years === 1 ? "1 year" : `${years} years`;
}

/**
 * A heading over a day, or over a stretch from `from` to `to`. Both carry the
 * year whenever it isn't `today`'s; a stretch inside one past year names it
 * once, at its end.
 */
export function headingLabel(from: number, to: number, today: number) {
  if (isSameDay(from, to)) return dayLabel(to, today);
  const end = format(to, isSameYear(to, today) ? "MMM d" : "MMM d, yyyy");
  const start = format(from, isSameYear(from, to) ? "MMM d" : "MMM d, yyyy");
  return `${start} – ${end}`;
}

function dayLabel(at: number, today: number) {
  if (isSameDay(at, today)) return "Today";
  if (isSameDay(at, subDays(today, 1))) return "Yesterday";
  return format(
    at,
    isSameYear(at, today) ? "EEEE, MMMM d" : "EEEE, MMMM d, yyyy",
  );
}
