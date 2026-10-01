import { startOfLocalDay, timeOfDay } from "@vita-os/core";
import { format } from "date-fns";

const DAY = 86_400_000;

function dayOffset(when: number, now: number) {
  return Math.round((startOfLocalDay(when) - startOfLocalDay(now)) / DAY);
}

export type WhenTone = "due" | "overdue";

/** Lateness, shared by a Note's When and a Thread's Follow-up. */
export function whenTone(
  when: number | undefined,
  now: number,
): WhenTone | undefined {
  if (when == null) return undefined;

  const days = dayOffset(when, now);
  if (days < 0) return "overdue";
  if (days === 0) return "due";

  return undefined;
}

/** The time a When carries as a token — 3 PM, 3:30 PM — or none. */
export function timeToken(when: number): string | undefined {
  if (timeOfDay(when) === undefined) return undefined;
  return format(when, new Date(when).getMinutes() === 0 ? "h a" : "h:mm a");
}

/** A date written with its time when it has one: May 20 · 3 PM. */
export function withTimeToken(date: string, when: number): string {
  const time = timeToken(when);
  return time === undefined ? date : `${date} · ${time}`;
}
