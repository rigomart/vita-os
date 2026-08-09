import { format } from "date-fns";

import type { DayDropPlan, PlanItem } from "./plan-model";

import {
  byDateThenTitle,
  dayAt,
  dayDelta,
  dayKey,
  MAX_HORIZON,
  MIN_HORIZON,
  NEAR_DAYS,
  planDayDrop,
} from "./plan-model";

/**
 * Model for the Plan schedule — the phone's vertical agenda.
 *
 * The canvas compresses its day axis sideways; a phone has no sideways to
 * spend, so this one runs down the screen and compresses by *folding*: the near
 * horizon prints every day, empty ones included — a calendar that hides
 * Thursday because nothing is on it stops being a calendar — and only the quiet
 * stretches past it collapse into a single "N quiet days" row.
 *
 * Same dates, same day keys and the same drop rules as the canvas: everything
 * here is pure, and the view rebuilds it from the dashboard query on every
 * render.
 */

/* -------------------------------------------------------------- schedule -- */

/** One line of the agenda. Days and gaps carry the offsets they stand for. */
export type ScheduleRow =
  | { from: number; key: string; kind: "gap"; to: number }
  | { key: string; kind: "day"; offset: number }
  | { key: string; kind: "month"; label: string };

export interface Schedule {
  /** Day key → the items planned on it, earliest first. */
  byDay: Map<string, PlanItem[]>;
  none: PlanItem[];
  overdue: PlanItem[];
  rows: ScheduleRow[];
  /** Everything the schedule holds, undated and overdue included. */
  total: number;
}

/**
 * One pass from `PlanItem[]` to the rows the schedule renders.
 *
 * `items` is the **visible** set: filtering an Area out empties the days only
 * it occupied, which lets them fold away like any other quiet day.
 */
export function buildSchedule(items: PlanItem[], now: number): Schedule {
  const byDay = new Map<string, PlanItem[]>();
  const none: PlanItem[] = [];
  const overdue: PlanItem[] = [];
  let furthest = 0;

  for (const item of items) {
    if (item.date == null) {
      none.push(item);
      continue;
    }
    const offset = dayDelta(item.date, now);
    if (offset < 0) {
      overdue.push(item);
      continue;
    }
    if (offset > furthest) furthest = offset;
  }

  const horizon = Math.min(MAX_HORIZON, Math.max(MIN_HORIZON, furthest));

  for (const item of items) {
    if (item.date == null) continue;
    const offset = dayDelta(item.date, now);
    if (offset < 0) continue;
    // Anything past the horizon piles into the last day it prints, so a very
    // distant date is still reachable rather than dropped.
    const key = dayKey(Math.min(offset, horizon));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }

  for (const bucket of byDay.values()) bucket.sort(byDateThenTitle);
  overdue.sort(byDateThenTitle);
  none.sort(byDateThenTitle);

  const rows: ScheduleRow[] = [];
  let month = "";

  /** A band whenever the list crosses into a new month, the first included. */
  function pushMonth(at: number) {
    const label = monthLabel(at);
    if (label === month) return;
    month = label;
    rows.push({ key: `m${label}`, kind: "month", label });
  }

  let gapFrom: number | null = null;
  function flushGap(to: number) {
    if (gapFrom == null) return;
    pushMonth(dayAt(gapFrom, now));
    rows.push({ from: gapFrom, key: `g${gapFrom}`, kind: "gap", to });
    gapFrom = null;
  }

  for (let offset = 0; offset <= horizon; offset += 1) {
    const occupied = (byDay.get(dayKey(offset))?.length ?? 0) > 0;
    // Today is inside the near horizon, so the present never folds away.
    if (!occupied && offset >= NEAR_DAYS) {
      if (gapFrom == null) gapFrom = offset;
      continue;
    }
    flushGap(offset - 1);
    pushMonth(dayAt(offset, now));
    rows.push({ key: dayKey(offset), kind: "day", offset });
  }
  flushGap(horizon);

  return { byDay, none, overdue, rows, total: items.length };
}

/** "August 2026" — the band that pins under the app bar. */
export function monthLabel(at: number): string {
  return format(new Date(at), "MMMM yyyy");
}

/* ------------------------------------------------------------------ drop -- */

/**
 * What a drop on this surface means.
 *
 * The schedule has no lanes, so `planDayDrop` is the whole rule set: the past
 * refuses, No date clears, and a day key names the exact date it writes. A drop
 * back onto the row it came from comes back as `reschedule: false` — the
 * caption still names the day, but nothing is written.
 */
export function planScheduleDrop(
  from: string,
  to: string,
  now: number,
): DayDropPlan | null {
  return planDayDrop(from, to, (key) => {
    const match = /^d(\d+)$/.exec(key);
    if (!match) return undefined;
    return dayAt(Math.min(Number(match[1]), MAX_HORIZON), now);
  });
}
