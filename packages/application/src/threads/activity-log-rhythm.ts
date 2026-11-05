import type { ActivityLogEntry } from "@vita-os/contracts";

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isSameYear,
  startOfDay,
} from "date-fns";

/** A folded stretch of one Task's completions, read for its rhythm. */
export interface Rhythm {
  /** Each completion's moment, oldest first. */
  times: number[];
  /** Each day with a completion, at its start, oldest first. */
  days: number[];
  /**
   * Days between completions most of the time; absent when irregular, or too
   * short a stretch to tell.
   */
  step?: number;
  /** Days the step expected one and none came, at their start. */
  quiet: number[];
}

/** Reads one Task's completions, in any order, for their rhythm. */
export function readRhythm(logs: readonly ActivityLogEntry[]): Rhythm {
  const times = logs.map((log) => log.createdAt).sort((a, b) => a - b);
  const days = [...new Set(times.map((at) => startOfDay(at).getTime()))];
  const gaps = days
    .slice(1)
    .map((day, index) => differenceInCalendarDays(day, days[index]!));
  const step = commonGap(gaps);
  const quiet: number[] = [];
  if (step !== undefined) {
    gaps.forEach((gap, index) => {
      const skipped = Math.round(gap / step) - 1;
      for (let k = 1; k <= skipped; k++) {
        quiet.push(
          (monthly(step)
            ? addMonths(days[index]!, k)
            : addDays(days[index]!, step * k)
          ).getTime(),
        );
      }
    });
  }
  return { times, days, ...(step === undefined ? {} : { step }), quiet };
}

function commonGap(gaps: number[]) {
  const counts = new Map<number, number>();
  for (const gap of gaps) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  const [gap, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return count !== undefined && count >= 2 && count * 2 >= gaps.length
    ? gap
    : undefined;
}

function monthly(step: number) {
  return step >= 28 && step <= 31;
}

/**
 * The rhythm in a few plain words, "Every day around 8:10 PM · none on Mon,
 * Sep 21": a day with none is said as a fact, never as a miss. A stretch
 * within one day has no rhythm to tell, and reads nothing.
 */
export function describeRhythm(rhythm: Rhythm, today: number) {
  if (rhythm.days.length < 2) return undefined;
  const around = usualTime(rhythm.times);
  const parts = [
    `${cadence(rhythm)}${around === undefined ? "" : ` around ${around}`}`,
  ];
  const { quiet, step } = rhythm;
  if (quiet.length > 0 && quiet.length <= 2) {
    parts.push(
      `none on ${quiet.map((day) => shortDay(day, today)).join(" and ")}`,
    );
  } else if (quiet.length > 2) {
    parts.push(
      step === 7
        ? `none in ${quiet.length} of the weeks`
        : step === 1
          ? `none on ${quiet.length} days`
          : `${quiet.length} times with none`,
    );
  }
  return parts.join(" · ");
}

function cadence({ step, days }: Rhythm) {
  if (step === undefined) return `On ${days.length} days`;
  if (step === 1) return "Every day";
  const weekday =
    step % 7 === 0 &&
    days.every((day) => new Date(day).getDay() === new Date(days[0]!).getDay())
      ? `, on ${format(days[0]!, "EEEE")}s`
      : "";
  if (step === 7) return `Every week${weekday}`;
  if (step === 14) return `Every two weeks${weekday}`;
  if (monthly(step)) return "Every month";
  return `Every ${step} days${weekday}`;
}

function usualTime(times: readonly number[]) {
  const minutes = times.map((at) => {
    const date = new Date(at);
    return date.getHours() * 60 + date.getMinutes();
  });
  if (Math.max(...minutes) - Math.min(...minutes) > 60) return undefined;
  const middle = [...minutes].sort((a, b) => a - b)[
    Math.floor(minutes.length / 2)
  ]!;
  const date = new Date(times[0]!);
  date.setHours(Math.floor(middle / 60), middle % 60, 0, 0);
  return format(date, "h:mm a");
}

/** `Mon, Sep 21`, with the year when it isn't `today`'s. */
export function shortDay(at: number, today: number) {
  return format(at, isSameYear(at, today) ? "EEE, MMM d" : "EEE, MMM d, yyyy");
}
