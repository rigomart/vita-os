import { startOfLocalDay } from "@convex/lib/attentionOrdering";
import { format } from "date-fns";

import type { MockThread } from "../mock-data";

/**
 * Horizon board model.
 *
 * The board is a kanban across *fuzzy* time horizons rather than exact dates.
 * A Follow-up is a soft resurfacing date, so every column owns a "landing
 * date" — the concrete Follow-up a Thread receives when it is dropped there.
 * Landing dates are surfaced in the column header so a drop is never a
 * surprise.
 */

const DAY_MS = 86_400_000;
const LANDING_HOUR = 9;

export type HorizonKey =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this-week"
  | "next-week"
  | "later";

/** Where a Thread sits on the board. `"none"` is the No-date tray. */
export type Placement = HorizonKey | "none";

export interface Horizon {
  /** Soft capacity — above this the column reads as "stacking up". */
  capacity: number;
  /** Sub-label under the column title. */
  hint: string;
  key: HorizonKey;
  /** Follow-up applied on drop. `undefined` for Overdue (not a drop target). */
  landing?: number;
  label: string;
}

/** Whole days between two timestamps, compared by local calendar day. */
export function dayIndex(when: number, now: number): number {
  return Math.round((startOfLocalDay(when) - startOfLocalDay(now)) / DAY_MS);
}

/** Local timestamp `offset` days from `now`, at the canonical landing hour. */
function landingAt(now: number, offset: number): number {
  const base = new Date(now);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offset,
    LANDING_HOUR,
  ).getTime();
}

/** Days from `now` until the Sunday that closes the current week. */
function daysToWeekEnd(now: number): number {
  const weekday = new Date(now).getDay();
  return weekday === 0 ? 0 : 7 - weekday;
}

/**
 * The columns to render for a given "today".
 *
 * `This week` disappears late in the week when its range would collapse into
 * Tomorrow, so the board never shows a column that can't hold anything.
 */
export function buildHorizons(now: number): Horizon[] {
  const weekEnd = daysToWeekEnd(now);
  const horizons: Horizon[] = [
    {
      key: "overdue",
      label: "Overdue",
      hint: "waiting on you",
      capacity: 0,
    },
    {
      key: "today",
      label: "Today",
      hint: format(new Date(landingAt(now, 0)), "EEE d MMM"),
      landing: landingAt(now, 0),
      capacity: 4,
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      hint: format(new Date(landingAt(now, 1)), "EEE d MMM"),
      landing: landingAt(now, 1),
      capacity: 4,
    },
  ];

  if (weekEnd >= 2) {
    horizons.push({
      key: "this-week",
      label: "This week",
      hint: `lands ${format(new Date(landingAt(now, weekEnd)), "EEE d")}`,
      landing: landingAt(now, weekEnd),
      capacity: 6,
    });
  }

  horizons.push(
    {
      key: "next-week",
      label: "Next week",
      hint: `lands ${format(new Date(landingAt(now, weekEnd + 1)), "EEE d")}`,
      landing: landingAt(now, weekEnd + 1),
      capacity: 6,
    },
    {
      key: "later",
      label: "Later",
      hint: `lands ${format(new Date(landingAt(now, weekEnd + 8)), "EEE d")}`,
      landing: landingAt(now, weekEnd + 8),
      capacity: 8,
    },
  );

  return horizons;
}

/** Which column a Follow-up belongs in. */
export function placementOf(
  followUp: number | undefined,
  now: number,
): Placement {
  if (followUp == null) return "none";

  const offset = dayIndex(followUp, now);
  if (offset < 0) return "overdue";
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";

  const weekEnd = daysToWeekEnd(now);
  if (weekEnd >= 2 && offset <= weekEnd) return "this-week";
  if (offset <= weekEnd + 7) return "next-week";

  return "later";
}

/** Threads bucketed per column, each bucket sorted by Follow-up then order. */
export function groupByPlacement(
  threads: MockThread[],
  now: number,
): Map<Placement, MockThread[]> {
  const groups = new Map<Placement, MockThread[]>();

  for (const thread of threads) {
    const key = placementOf(thread.followUp, now);
    const bucket = groups.get(key);
    if (bucket) bucket.push(thread);
    else groups.set(key, [thread]);
  }

  for (const bucket of groups.values()) {
    bucket.sort(
      (a, b) => (a.followUp ?? 0) - (b.followUp ?? 0) || a.order - b.order,
    );
  }

  return groups;
}

/** "3d late" — only meaningful inside the Overdue column. */
export function latenessLabel(followUp: number, now: number): string {
  const late = -dayIndex(followUp, now);
  if (late <= 0) return "due today";
  if (late < 14) return `${late}d late`;
  return `${Math.floor(late / 7)}w late`;
}

/** Short date chip on a card: "Aug 13". */
export function shortDate(when: number): string {
  return format(new Date(when), "d MMM");
}

/** Confirmation copy after a drop: "Follow-up → Sun 9 Aug". */
export function followUpLabel(when: number | undefined): string {
  if (when == null) return "Follow-up cleared";
  return `Follow-up → ${format(new Date(when), "EEE d MMM")}`;
}
