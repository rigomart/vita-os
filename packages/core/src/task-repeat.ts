import type { Repeat } from "@vita-os/contracts";

import { ValidationError } from "./errors";

export function requireRepeat(value: unknown): Repeat {
  if (typeof value === "object" && value !== null) {
    if ("kind" in value && value.kind === "days" && "every" in value) {
      if (
        typeof value.every === "number" &&
        Number.isInteger(value.every) &&
        value.every >= 1 &&
        value.every <= 365
      ) {
        return { kind: "days", every: value.every };
      }
    }
    if (
      "kind" in value &&
      value.kind === "weekly" &&
      "weekdays" in value &&
      Array.isArray(value.weekdays)
    ) {
      const days: unknown[] = value.weekdays;
      if (
        days.length > 0 &&
        days.length <= 7 &&
        new Set(days).size === days.length &&
        days.every(
          (day) =>
            typeof day === "number" &&
            Number.isInteger(day) &&
            day >= 0 &&
            day <= 6,
        )
      ) {
        return {
          kind: "weekly",
          weekdays: [...(days as number[])].sort((a, b) => a - b),
        };
      }
    }
    if ("kind" in value && value.kind === "monthly" && "day" in value) {
      if (
        typeof value.day === "number" &&
        Number.isInteger(value.day) &&
        value.day >= 1 &&
        value.day <= 31
      ) {
        return { kind: "monthly", day: value.day };
      }
    }
  }
  throw new ValidationError("Invalid Repeat");
}

/** Intl supplies IANA rules in browsers and Cloudflare Workers alike. */
function calendar(timeZone: string | undefined): Intl.DateTimeFormat {
  if (
    typeof timeZone !== "string" ||
    timeZone.length === 0 ||
    /^[+-]/.test(timeZone)
  ) {
    throw new ValidationError("Invalid time zone");
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "iso8601",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hourCycle: "h23",
    });
  } catch {
    throw new ValidationError("Invalid time zone");
  }
}

export function requireTimeZone(timeZone: string | undefined): string {
  calendar(timeZone);
  return timeZone!;
}

const DAY = 86_400_000;

/**
 * A UTC-shaped number representing local calendar fields, not an instant.
 * UTC arithmetic here counts calendar days; it never adds 24 hours to the
 * stored instant. Keep seconds and milliseconds as well as hours/minutes.
 */
function localFields(date: number, zone: Intl.DateTimeFormat): number {
  const parts = Object.fromEntries(
    zone.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    Number(parts.fractionalSecond),
  );
}

function dayOf(fields: number): number {
  return Math.floor(fields / DAY);
}

/**
 * Convert wall-clock fields to an instant. Sample both sides of a possible
 * transition (including IANA's 24-hour date-line jumps), then try each offset.
 * Compatible disambiguation: choose the earlier instant in an overlap; in a
 * gap use the prior offset, moving the missing wall time forward by the gap.
 */
function instant(fields: number, zone: Intl.DateTimeFormat): number {
  const offsets = new Set(
    [-2, 0, 2].map((days) => {
      const sample = fields + days * DAY;
      return localFields(sample, zone) - sample;
    }),
  );
  const candidates = [...offsets].map((offset) => fields - offset);
  const exact = candidates.filter(
    (candidate) => localFields(candidate, zone) === fields,
  );
  return exact.length > 0 ? Math.min(...exact) : Math.max(...candidates);
}

/** Midnight, or the first instant of the day when midnight is skipped. */
function startOfDay(day: number, zone: Intl.DateTimeFormat): number {
  const midnight = day * DAY;
  const candidate = instant(midnight, zone);
  if (localFields(candidate, zone) === midnight) return candidate;

  // A gap may begin before midnight, so its compatible result can be later
  // than the day's first instant. Find the actual start, to the millisecond.
  let before = candidate - DAY;
  let after = candidate;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (dayOf(localFields(middle, zone)) < day) before = middle;
    else after = middle;
  }
  return after;
}

function repeatedDate(
  date: number,
  day: number,
  targetDay: number,
  fields: number,
  zone: Intl.DateTimeFormat,
): number {
  return date === startOfDay(day, zone)
    ? startOfDay(targetDay, zone)
    : instant(fields + (targetDay - day) * DAY, zone);
}

function chosenDay(day: number, weekdays: readonly number[]): number {
  // 1970-01-01 (day zero) was Thursday, weekday 4.
  const weekday = (((day + 4) % 7) + 7) % 7;
  return (
    day + Math.min(...weekdays.map((chosen) => (chosen - weekday + 7) % 7))
  );
}

/**
 * The day a monthly Repeat lands on in the month `months` after January 1970:
 * its chosen day, or the month's last day when the month is shorter.
 */
function monthlyDay(months: number, chosen: number): number {
  const length = new Date(Date.UTC(1970, months + 1, 0)).getUTCDate();
  return Date.UTC(1970, months, Math.min(chosen, length)) / DAY;
}

function monthOf(day: number): number {
  const date = new Date(day * DAY);
  return (date.getUTCFullYear() - 1970) * 12 + date.getUTCMonth();
}

/** The first day on or after `from` a monthly Repeat lands on. */
function chosenMonthDay(from: number, chosen: number): number {
  const month = monthOf(from);
  const day = monthlyDay(month, chosen);
  return day >= from ? day : monthlyDay(month + 1, chosen);
}

/**
 * A monthly Repeat follows its Task to a new day: Dec 12 repeats on the 12th.
 * A new time on the same day keeps it, so Feb 28 at 10:00 still returns to
 * the 31st it stood in for.
 */
export function movedRepeat(
  repeat: Extract<Repeat, { kind: "monthly" }>,
  previous: number | undefined,
  date: number,
  timeZone: string,
): Repeat {
  const zone = calendar(timeZone);
  const fields = localFields(date, zone);
  return previous !== undefined &&
    dayOf(localFields(previous, zone)) === dayOf(fields)
    ? repeat
    : { kind: "monthly", day: new Date(fields).getUTCDate() };
}

export function snapTaskDate(
  date: number,
  repeat: Repeat,
  timeZone: string,
): number {
  const zone = calendar(timeZone);
  if (repeat.kind === "days") return date;
  const fields = localFields(date, zone);
  const day = dayOf(fields);
  const snapped =
    repeat.kind === "weekly"
      ? chosenDay(day, repeat.weekdays)
      : chosenMonthDay(day, repeat.day);
  // Keep an existing instant on a chosen day, even in a fall-back overlap.
  return snapped === day
    ? date
    : repeatedDate(date, day, snapped, fields, zone);
}

export function nextTaskDate(
  date: number,
  repeat: Repeat,
  timeZone: string,
  now: number,
): number {
  const zone = calendar(timeZone);
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) {
    throw new ValidationError("Invalid current time");
  }
  // Timed Tasks read the stored wall time: after a DST gap shifts it forward,
  // later occurrences keep that shifted time (an accepted limitation).
  const fields = localFields(date, zone);
  const current = dayOf(fields);
  const today = dayOf(localFields(now, zone));
  const from = Math.max(current + 1, today);
  const next =
    repeat.kind === "days"
      ? current +
        Math.max(1, Math.ceil((today - current) / repeat.every)) * repeat.every
      : repeat.kind === "weekly"
        ? chosenDay(from, repeat.weekdays)
        : chosenMonthDay(from, repeat.day);
  return repeatedDate(date, current, next, fields, zone);
}
