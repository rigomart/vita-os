import { startOfLocalDay } from "@convex/lib/attentionOrdering";

const DAY = 86_400_000;

function dayOffset(when: number, now: number) {
  return Math.round((startOfLocalDay(when) - startOfLocalDay(now)) / DAY);
}

export type WhenTone = "due" | "overdue";

/** Lateness, shared by a Task's When and a Thread's Follow-up. */
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
