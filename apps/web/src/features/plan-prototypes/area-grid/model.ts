import type { Condition } from "@convex/lib/condition";

import { addDays, format, startOfDay } from "date-fns";

import type { MockArea, MockThread } from "../mock-data";

import { DAY, mockAreas } from "../mock-data";

/**
 * Grid model for the "Area × time grid" Plan exploration.
 *
 * Rows are Life Areas ordered by Condition; columns are fuzzy time horizons
 * derived from each Thread's Follow-up. Everything here is pure so the view can
 * recompute the whole matrix from a flat Thread list on every render.
 */

export type ColumnKey =
  | "overdue"
  | "today"
  | "this-week"
  | "next-week"
  | "later"
  | "none";

export type ColumnTone = "attention" | "now" | "soon" | "quiet";

/** What dropping a chip into a column does to its Follow-up. */
export type DropAction = "schedule" | "clear" | null;

export interface PlanColumn {
  /** Timestamp written to `followUp` on drop; `undefined` when `drop` clears. */
  dropAt?: number;
  drop: DropAction;
  key: ColumnKey;
  /** Small date range printed under the column label. */
  caption: string;
  label: string;
  tone: ColumnTone;
}

export interface AreaRow {
  area: MockArea;
  cells: Record<ColumnKey, MockThread[]>;
  /** No Follow-up anywhere: the row is hollow. */
  hollow: boolean;
  /** Threads not resolved. */
  openCount: number;
  /** Nothing in Overdue / Today / This week — the neglect signal. */
  neglected: boolean;
  plannedCount: number;
}

const HOUR_OF_DAY = 9;

function atMorning(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    HOUR_OF_DAY,
  ).getTime();
}

/** Whole local days between two timestamps; negative when `when` is past. */
export function dayDelta(when: number, now: number): number {
  return Math.round(
    (startOfDay(new Date(when)).getTime() -
      startOfDay(new Date(now)).getTime()) /
      DAY,
  );
}

/** Days left in the current week after today, treating Monday as day one. */
function daysLeftThisWeek(now: number): number {
  const isoDay = (new Date(now).getDay() + 6) % 7;
  return 6 - isoDay;
}

export function columnFor(
  followUp: number | undefined,
  now: number,
): ColumnKey {
  if (followUp == null) return "none";

  const delta = dayDelta(followUp, now);
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";

  const restOfWeek = daysLeftThisWeek(now);
  if (delta <= restOfWeek) return "this-week";
  if (delta <= restOfWeek + 7) return "next-week";
  return "later";
}

/**
 * The visible columns, left to right. `Overdue` only earns a column when
 * something is actually late — an empty Overdue column is just noise.
 */
export function buildColumns(now: number, hasOverdue: boolean): PlanColumn[] {
  const base = startOfDay(new Date(now));
  const restOfWeek = daysLeftThisWeek(now);
  const tomorrow = addDays(base, 1);
  const weekEnd = addDays(base, restOfWeek);
  const nextWeekStart = addDays(base, restOfWeek + 1);
  const nextWeekEnd = addDays(base, restOfWeek + 7);
  const laterStart = addDays(base, restOfWeek + 8);

  const columns: PlanColumn[] = [];

  if (hasOverdue) {
    columns.push({
      key: "overdue",
      label: "Overdue",
      caption: "waiting on you",
      drop: null,
      tone: "attention",
    });
  }

  columns.push({
    key: "today",
    label: "Today",
    caption: format(base, "EEE d MMM"),
    drop: "schedule",
    dropAt: atMorning(base),
    tone: "now",
  });

  if (restOfWeek >= 1) {
    columns.push({
      key: "this-week",
      label: "This week",
      caption:
        restOfWeek === 1
          ? format(weekEnd, "EEE d")
          : `${format(tomorrow, "EEE")} – ${format(weekEnd, "EEE")}`,
      drop: "schedule",
      dropAt: atMorning(tomorrow),
      tone: "soon",
    });
  }

  columns.push(
    {
      key: "next-week",
      label: "Next week",
      caption: `${format(nextWeekStart, "MMM d")} – ${format(nextWeekEnd, "d")}`,
      drop: "schedule",
      dropAt: atMorning(nextWeekStart),
      tone: "soon",
    },
    {
      key: "later",
      label: "Later",
      caption: `${format(laterStart, "MMM d")} onward`,
      drop: "schedule",
      dropAt: atMorning(addDays(laterStart, 7)),
      tone: "quiet",
    },
    {
      key: "none",
      label: "No date",
      caption: "unscheduled",
      drop: "clear",
      tone: "quiet",
    },
  );

  return columns;
}

const conditionRank: Record<Condition, number> = {
  critical: 0,
  needs_attention: 1,
  healthy: 2,
};

/**
 * The forward-looking horizon. Overdue is deliberately excluded: an Area whose
 * only dated Thread is already late has nothing *planned*, it has a debt.
 */
const NEAR_TERM: ColumnKey[] = ["today", "this-week"];

function emptyCells(): Record<ColumnKey, MockThread[]> {
  return {
    overdue: [],
    today: [],
    "this-week": [],
    "next-week": [],
    later: [],
    none: [],
  };
}

/** Areas as rows, ordered by Condition then by the Area's own order. */
export function buildRows(threads: MockThread[], now: number): AreaRow[] {
  const byArea = new Map<string, Record<ColumnKey, MockThread[]>>();
  for (const area of mockAreas) byArea.set(area.id, emptyCells());

  for (const thread of threads) {
    const cells = byArea.get(thread.areaId);
    if (!cells) continue;
    cells[columnFor(thread.followUp, now)].push(thread);
  }

  return mockAreas
    .map((area) => {
      const cells = byArea.get(area.id) ?? emptyCells();
      const openCount = threads.filter(
        (thread) => thread.areaId === area.id,
      ).length;
      const plannedCount = openCount - cells.none.length;
      const nearTerm = NEAR_TERM.reduce(
        (total, key) => total + cells[key].length,
        0,
      );

      return {
        area,
        cells,
        hollow: plannedCount === 0 && openCount > 0,
        neglected: nearTerm === 0 && openCount > 0,
        openCount,
        plannedCount,
      } satisfies AreaRow;
    })
    .sort(
      (a, b) =>
        conditionRank[a.area.condition] - conditionRank[b.area.condition] ||
        a.area.order - b.area.order,
    );
}

export function columnTotals(rows: AreaRow[]): Record<ColumnKey, number> {
  const totals = {
    overdue: 0,
    today: 0,
    "this-week": 0,
    "next-week": 0,
    later: 0,
    none: 0,
  };

  for (const row of rows) {
    for (const key of Object.keys(totals) as ColumnKey[]) {
      totals[key] += row.cells[key].length;
    }
  }

  return totals;
}

/* ---------------------------------------------------------------- tokens -- */

export const conditionIconTone: Record<Condition, string> = {
  critical: "bg-condition-critical text-white",
  needs_attention: "bg-condition-attention/15 text-condition-attention",
  healthy: "bg-surface-3 text-muted-foreground",
};

export const conditionRowTint: Record<Condition, string> = {
  critical: "bg-condition-critical/[0.045]",
  needs_attention: "bg-condition-attention/[0.035]",
  healthy: "",
};

export const conditionRailTone: Record<Condition, string> = {
  critical: "bg-condition-critical",
  needs_attention: "bg-condition-attention/60",
  healthy: "bg-transparent",
};

export const columnLabelTone: Record<ColumnTone, string> = {
  attention: "text-condition-attention",
  now: "text-foreground",
  soon: "text-muted-foreground",
  quiet: "text-muted-foreground/70",
};

export const columnBarTone: Record<ColumnTone, string> = {
  attention: "bg-condition-attention/70",
  now: "bg-foreground/45",
  soon: "bg-foreground/22",
  quiet: "bg-foreground/12",
};

/** Human label for a Follow-up, used in chips and confirmations. */
export function followUpLabel(
  followUp: number | undefined,
  now: number,
): string {
  if (followUp == null) return "no date";

  const delta = dayDelta(followUp, now);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "1d late";
  if (delta < 0) return `${-delta}d late`;
  return format(new Date(followUp), "MMM d");
}
