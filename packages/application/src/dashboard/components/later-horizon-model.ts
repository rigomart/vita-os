import { addDays, addMonths, format, startOfMonth } from "date-fns";

import type { BoardItem } from "./attention-board-model";

import { dayDelta, startOfLocalDay } from "./dashboard-model";

/** Later begins a week out, where This week ends. */
const START = 7;

/** The horizon reaches at least this far, then on to the end of that month. */
const MIN_REACH = 63;

/** A band shorter than this has no room for its label. */
const LABELED_BAND = 7;

/**
 * Later folded into a scale: what is coming, and when, without any of it
 * needing to be read.
 *
 * The scale runs from a week out to the end of the month nine weeks out, in
 * the same bands the open Later column groups by: each of the next three
 * weeks, then calendar months. An item is a mark at its day; anything past
 * the end is only counted. Positions are fractions of the scale, from 0 at
 * the top to 1 at the foot.
 */
export interface Horizon {
  bands: HorizonBand[];
  /** Items past the scale's end, counted rather than drawn. */
  beyond: number;
  /** The day the scale ends on, for saying what `beyond` is past. */
  end: number;
  marks: HorizonMark[];
}

export interface HorizonBand {
  from: number;
  key: string;
  label?: string;
  to: number;
}

export interface HorizonMark {
  at: number;
  item: BoardItem;
  /** The soonest item, which the folded lane also names as `next`. */
  next: boolean;
  /** Items due the same day sit side by side: this one's place, of `of`. */
  of: number;
  slot: number;
}

export function buildHorizon(items: BoardItem[], currentDate: number): Horizon {
  const today = startOfLocalDay(currentDate);
  const end = dayDelta(
    startOfMonth(addMonths(addDays(today, MIN_REACH), 1)).getTime(),
    currentDate,
  );
  const span = end - START;
  const fraction = (day: number) => (day - START) / span;

  const bands: HorizonBand[] = [1, 2, 3].map((week) => ({
    key: `week-${week}`,
    label: `${week}w`,
    from: fraction(week * 7),
    to: fraction(week * 7 + 7),
  }));
  for (let day = 28; day < end; ) {
    const date = addDays(today, day);
    const next = Math.min(
      end,
      dayDelta(startOfMonth(addMonths(date, 1)).getTime(), currentDate),
    );
    bands.push({
      key: `month-${format(date, "yyyy-MM")}`,
      ...(next - day >= LABELED_BAND && { label: format(date, "MMM") }),
      from: fraction(day),
      to: fraction(next),
    });
    day = next;
  }

  const drawn = items.filter(
    (item) => dayDelta(item.when ?? currentDate, currentDate) < end,
  );
  const sameDay = new Map<number, number>();
  for (const item of drawn) {
    const day = dayDelta(item.when ?? currentDate, currentDate);
    sameDay.set(day, (sameDay.get(day) ?? 0) + 1);
  }
  const placed = new Map<number, number>();
  const marks = drawn.map((item, index): HorizonMark => {
    const day = dayDelta(item.when ?? currentDate, currentDate);
    const slot = placed.get(day) ?? 0;
    placed.set(day, slot + 1);
    return {
      item,
      at: fraction(day + 0.5),
      next: index === 0,
      slot,
      of: sameDay.get(day) ?? 1,
    };
  });

  return { bands, marks, beyond: items.length - drawn.length, end };
}
