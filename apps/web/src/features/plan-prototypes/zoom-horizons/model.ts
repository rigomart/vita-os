import type { Condition } from "@convex/lib/condition";

import { format, startOfDay } from "date-fns";

import type { MockActivity, MockArea } from "../mock-data";

import { DAY, mockAreas, mockTasks, mockThreads } from "../mock-data";

/**
 * Model for the **Zoom horizons** Plan view.
 *
 * The canvas is the same Area × time grid as the base: rows are Life Areas
 * worst condition first plus a pinned Inbox row for Tasks, columns are fuzzy
 * horizons, `No date` is pinned right.
 *
 * The one difference lives here: a fuzzy column is not a single landing date,
 * it is a **range of days**. `expansionSlots` turns any multi-day column into
 * the exact days it covers, and the view splits the column into those days the
 * moment precision is needed. `dropAt` on a column is only the resting
 * shorthand — every real drop carries a day of its own.
 *
 * Everything here is pure: the view rebuilds the whole matrix from a flat item
 * list on every render, and nothing from `mock-data` is ever mutated.
 */

/* ----------------------------------------------------------------- items -- */

export type PlanItemKind = "task" | "thread";

/**
 * One planable thing.
 *
 * A **Thread** has an Area, at most one **Next Move**, and a soft **Follow-up**.
 * An inbox **Task** has neither Area nor Next Move, only a soft **When**.
 * `date` is whichever of the two the item carries — never a deadline.
 */
export interface PlanItem {
  /** Threads only. */
  areaId?: string;
  /** Tasks only: when it landed in the Inbox. */
  createdAt?: number;
  /** Follow-up (Thread) or When (Task). Undefined is a legitimate state. */
  date?: number;
  id: string;
  kind: PlanItemKind;
  /** Threads only. */
  lastActivity?: MockActivity;
  /** Threads only, and at most one — never a checklist. */
  nextMove?: string;
  /** Threads only. */
  summary?: string;
  title: string;
}

export function seedItems(): PlanItem[] {
  const threads: PlanItem[] = mockThreads.map((thread) => ({
    areaId: thread.areaId,
    date: thread.followUp,
    id: thread.id,
    kind: "thread",
    lastActivity: thread.lastActivity,
    nextMove: thread.nextMove,
    summary: thread.summary,
    title: thread.title,
  }));

  const tasks: PlanItem[] = mockTasks.map((task) => ({
    createdAt: task.createdAt,
    date: task.when,
    id: task.id,
    kind: "task",
    title: task.text,
  }));

  return [...threads, ...tasks];
}

/* ----------------------------------------------------------------- dates -- */

const LANDING_HOUR = 9;

/** Whole local calendar days between two timestamps; negative when past. */
export function dayDelta(when: number, now: number): number {
  return Math.round(
    (startOfDay(new Date(when)).getTime() -
      startOfDay(new Date(now)).getTime()) /
      DAY,
  );
}

/** `offset` days from `now`, at the canonical resurfacing hour. */
export function dayAt(
  offset: number,
  now: number,
  hour = LANDING_HOUR,
): number {
  const base = new Date(now);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offset,
    hour,
  ).getTime();
}

/** Days left in the current week after today, treating Monday as day one. */
function daysLeftThisWeek(now: number): number {
  const isoDay = (new Date(now).getDay() + 6) % 7;
  return 6 - isoDay;
}

export type QuickTarget = "next-week" | "today" | "tomorrow" | "weekend";

export const quickTargets: { hint: string; key: QuickTarget; label: string }[] =
  [
    { key: "today", label: "Today", hint: "T" },
    { key: "tomorrow", label: "Tomorrow", hint: "M" },
    { key: "weekend", label: "Weekend", hint: "E" },
    { key: "next-week", label: "Next week", hint: "W" },
  ];

/** Resolve a preset chip to a concrete soft date. */
export function quickDate(target: QuickTarget, now: number): number {
  const today = new Date(now);

  switch (target) {
    case "today":
      return dayAt(0, now, 17);
    case "tomorrow":
      return dayAt(1, now);
    case "weekend": {
      // The upcoming Saturday; on a Saturday, "this weekend" is still today.
      return dayAt((6 - today.getDay() + 7) % 7, now, 10);
    }
    case "next-week":
      return dayAt(daysLeftThisWeek(now) + 1, now);
  }
}

/* --------------------------------------------------------------- columns -- */

export type ColumnKey =
  | "later"
  | "next-week"
  | "none"
  | "overdue"
  | "this-week"
  | "today"
  | "tomorrow";

export type ColumnTone = "attention" | "now" | "quiet" | "soon";

/** What dropping onto a column does to the item's soft date. */
export type DropAction = "clear" | "schedule" | null;

export interface PlanColumn {
  /** Landing-date contract, printed in the header. */
  caption: string;
  drop: DropAction;
  /** The resting landing date — only used while the column is collapsed. */
  dropAt?: number;
  key: ColumnKey;
  label: string;
  /** How many distinct days this column covers. 1 means it never splits. */
  span: number;
  tone: ColumnTone;
}

export function columnFor(date: number | undefined, now: number): ColumnKey {
  if (date == null) return "none";

  const delta = dayDelta(date, now);
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";

  const restOfWeek = daysLeftThisWeek(now);
  if (delta <= restOfWeek) return "this-week";
  if (delta <= restOfWeek + 7) return "next-week";
  return "later";
}

/**
 * Visible columns, left to right.
 *
 * Overdue only earns a column when something is actually late, and it is never
 * a drop target — you cannot schedule into the past. `This week` only earns a
 * column when there is a day left in the week that Tomorrow does not already
 * own.
 */
export function buildColumns(now: number, hasOverdue: boolean): PlanColumn[] {
  const restOfWeek = daysLeftThisWeek(now);
  const columns: PlanColumn[] = [];

  if (hasOverdue) {
    columns.push({
      key: "overdue",
      label: "Overdue",
      caption: "waiting for you",
      drop: null,
      span: 0,
      tone: "attention",
    });
  }

  columns.push(
    {
      key: "today",
      label: "Today",
      caption: format(new Date(now), "EEE d MMM"),
      drop: "schedule",
      dropAt: dayAt(0, now, 17),
      span: 1,
      tone: "now",
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      caption: format(dayAt(1, now), "EEE d MMM"),
      drop: "schedule",
      dropAt: dayAt(1, now),
      span: 1,
      tone: "now",
    },
  );

  if (restOfWeek >= 2) {
    columns.push({
      key: "this-week",
      label: "This week",
      caption: spanCaption(dayAt(2, now), dayAt(restOfWeek, now)),
      drop: "schedule",
      dropAt: dayAt(2, now),
      span: restOfWeek - 1,
      tone: "soon",
    });
  }

  columns.push(
    {
      key: "next-week",
      label: "Next week",
      caption: spanCaption(
        dayAt(restOfWeek + 1, now),
        dayAt(restOfWeek + 7, now),
      ),
      drop: "schedule",
      dropAt: dayAt(restOfWeek + 1, now),
      span: 7,
      tone: "soon",
    },
    {
      key: "later",
      label: "Later",
      caption: `from ${format(dayAt(restOfWeek + 8, now), "d MMM")}`,
      drop: "schedule",
      dropAt: dayAt(restOfWeek + 8, now),
      span: 7,
      tone: "quiet",
    },
    {
      key: "none",
      label: "No date",
      caption: "clears the date",
      drop: "clear",
      span: 0,
      tone: "quiet",
    },
  );

  return columns;
}

function spanCaption(from: number, to: number): string {
  return `${format(new Date(from), "EEE d")} – ${format(new Date(to), "EEE d")}`;
}

/* ------------------------------------------------------------- expansion -- */

/** One day a multi-day column covers — a real, droppable calendar day. */
export interface DaySlot {
  /** The exact timestamp a drop on this slot assigns. */
  at: number;
  /** Whole days from today. */
  delta: number;
  /** "Mon" */
  label: string;
  /** "11" */
  number: string;
  /** "Mon 11 Aug" — used by the drag caption and the hovered-slot pill. */
  long: string;
  weekend: boolean;
}

/** Columns that own more than one day, and therefore zoom. */
export const splittableColumns: ColumnKey[] = [
  "this-week",
  "next-week",
  "later",
];

export function isSplittable(key: ColumnKey | undefined): boolean {
  return key != null && splittableColumns.includes(key);
}

/**
 * The days a column covers.
 *
 * `laterWeek` picks which week of the open-ended `Later` horizon is in focus;
 * every other column ignores it. Returning fewer than two slots means the
 * column has nothing to zoom into and should stay collapsed.
 */
export function expansionSlots(
  key: ColumnKey,
  now: number,
  laterWeek = 0,
): DaySlot[] {
  const restOfWeek = daysLeftThisWeek(now);

  const deltas: number[] = [];
  if (key === "this-week") {
    for (let delta = 2; delta <= restOfWeek; delta += 1) deltas.push(delta);
  } else if (key === "next-week") {
    for (let step = 1; step <= 7; step += 1) deltas.push(restOfWeek + step);
  } else if (key === "later") {
    const start = restOfWeek + 8 + laterWeek * 7;
    for (let step = 0; step < 7; step += 1) deltas.push(start + step);
  }

  return deltas.map((delta) => {
    const at = dayAt(delta, now);
    const date = new Date(at);
    return {
      at,
      delta,
      label: format(date, "EEE"),
      number: format(date, "d"),
      long: format(date, "EEE d MMM"),
      weekend: date.getDay() === 0 || date.getDay() === 6,
    } satisfies DaySlot;
  });
}

/** The selectable weeks of the `Later` horizon, for its header strip. */
export function laterWeeks(
  now: number,
  count = 4,
): { index: number; label: string }[] {
  const restOfWeek = daysLeftThisWeek(now);
  return Array.from({ length: count }, (_, index) => ({
    index,
    label: format(dayAt(restOfWeek + 8 + index * 7, now), "d MMM"),
  }));
}

/** Which slot an item sits in, or -1 when it falls outside the focused week. */
export function slotIndexFor(
  date: number | undefined,
  slots: DaySlot[],
  now: number,
): number {
  if (date == null) return -1;
  const delta = dayDelta(date, now);
  return slots.findIndex((slot) => slot.delta === delta);
}

export const columnKeys: ColumnKey[] = [
  "overdue",
  "today",
  "tomorrow",
  "this-week",
  "next-week",
  "later",
  "none",
];

function emptyCells(): Record<ColumnKey, PlanItem[]> {
  return {
    overdue: [],
    today: [],
    tomorrow: [],
    "this-week": [],
    "next-week": [],
    later: [],
    none: [],
  };
}

/* ------------------------------------------------------------------ rows -- */

export const INBOX_ROW_ID = "inbox";

export interface AreaRow {
  area: MockArea;
  cells: Record<ColumnKey, PlanItem[]>;
  /**
   * Threads sitting on the forward-looking near horizon. Overdue is excluded
   * on purpose: an Area whose only dated Thread is already late has nothing
   * planned, it has a debt.
   */
  nearHorizon: number;
  openCount: number;
  overdueCount: number;
  plannedCount: number;
}

const conditionRank: Record<Condition, number> = {
  critical: 0,
  needs_attention: 1,
  healthy: 2,
};

/** Areas as rows, worst condition first, then by the Area's own order. */
export function buildAreaRows(items: PlanItem[], now: number): AreaRow[] {
  const byArea = new Map<string, Record<ColumnKey, PlanItem[]>>();
  for (const area of mockAreas) byArea.set(area.id, emptyCells());

  for (const item of items) {
    if (item.kind !== "thread" || item.areaId == null) continue;
    const cells = byArea.get(item.areaId);
    if (!cells) continue;
    cells[columnFor(item.date, now)].push(item);
  }

  const rows = mockAreas.map((area) => {
    const cells = byArea.get(area.id) ?? emptyCells();
    for (const key of columnKeys) cells[key].sort(byDateThenTitle);

    const openCount = columnKeys.reduce(
      (total, key) => total + cells[key].length,
      0,
    );

    return {
      area,
      cells,
      nearHorizon:
        cells.today.length + cells.tomorrow.length + cells["this-week"].length,
      openCount,
      overdueCount: cells.overdue.length,
      plannedCount: openCount - cells.none.length,
    } satisfies AreaRow;
  });

  return rows.sort(
    (a, b) =>
      conditionRank[a.area.condition] - conditionRank[b.area.condition] ||
      a.area.order - b.area.order,
  );
}

/** The pinned Inbox row: Tasks, keyed on their When. */
export function buildInboxCells(
  items: PlanItem[],
  now: number,
): Record<ColumnKey, PlanItem[]> {
  const cells = emptyCells();
  for (const item of items) {
    if (item.kind !== "task") continue;
    cells[columnFor(item.date, now)].push(item);
  }
  for (const key of columnKeys) cells[key].sort(byDateThenTitle);
  return cells;
}

function byDateThenTitle(a: PlanItem, b: PlanItem): number {
  const left = a.date ?? 0;
  const right = b.date ?? 0;
  if (left !== right) return left - right;
  return a.title.localeCompare(b.title);
}

export function columnTotals(
  cellSets: Record<ColumnKey, PlanItem[]>[],
): Record<ColumnKey, number> {
  const totals = {
    overdue: 0,
    today: 0,
    tomorrow: 0,
    "this-week": 0,
    "next-week": 0,
    later: 0,
    none: 0,
  } satisfies Record<ColumnKey, number>;

  for (const cells of cellSets) {
    for (const key of columnKeys) totals[key] += cells[key].length;
  }

  return totals;
}

/* --------------------------------------------------------- copy register -- */

export type DateTone = "attention" | "muted" | "today";

/**
 * The soft-date sentence. A Follow-up resurfaces; it is never due, and a date
 * in the past means the item has been waiting, not that it is late.
 */
export function dateSentence(
  item: Pick<PlanItem, "date" | "kind">,
  now: number,
): { text: string; tone: DateTone } {
  const verb = item.kind === "task" ? "Comes back" : "Resurfaces";

  if (item.date == null) {
    return {
      tone: "muted",
      text: item.kind === "task" ? "No when set" : "No Follow-up set",
    };
  }

  const delta = dayDelta(item.date, now);
  if (delta < 0) {
    return {
      tone: "attention",
      text: `Waiting since ${format(new Date(item.date), "EEE, MMM d")}`,
    };
  }
  if (delta === 0) return { tone: "today", text: `${verb} today` };
  if (delta === 1) return { tone: "muted", text: `${verb} tomorrow` };

  return {
    tone: "muted",
    text: `${verb} ${format(new Date(item.date), "EEE, MMM d")}`,
  };
}

/** Small stamp on a compact chip. Lateness reads as waiting, not failing. */
export function chipStamp(
  date: number | undefined,
  column: ColumnKey,
  now: number,
): string | undefined {
  if (date == null) return undefined;

  const delta = dayDelta(date, now);
  if (column === "overdue") return `${-delta}d`;
  if (column === "today" || column === "tomorrow") return undefined;
  if (column === "this-week") return format(new Date(date), "EEE");
  return format(new Date(date), "d MMM");
}

/** "3d ago" — for last-activity whispers and Inbox capture lines. */
export function agoLabel(timestamp: number, now: number): string {
  const days = -dayDelta(timestamp, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

/** Confirmation fragment after a reschedule: "resurfaces Mon 11 Aug". */
export function landedLabel(
  date: number | undefined,
  kind: PlanItemKind,
): string {
  if (date == null) {
    return kind === "task" ? "when cleared" : "Follow-up cleared";
  }
  const verb = kind === "task" ? "set for" : "resurfaces";
  return `${verb} ${format(new Date(date), "EEE d MMM")}`;
}

export function areaOf(
  item: PlanItem,
  areaById: ReadonlyMap<string, MockArea>,
): MockArea | undefined {
  return item.areaId == null ? undefined : areaById.get(item.areaId);
}

/* ---------------------------------------------------------------- tokens -- */

/** Short condition wording, so the row subtitle stays on one line. */
export const conditionShort: Record<Condition, string> = {
  critical: "Critical",
  needs_attention: "Needs you",
  healthy: "Healthy",
};

export const conditionIconTone: Record<Condition, string> = {
  critical: "bg-condition-critical text-white",
  needs_attention: "bg-condition-attention/15 text-condition-attention",
  healthy: "bg-surface-3 text-muted-foreground",
};

export const conditionRowTint: Record<Condition, string> = {
  critical: "bg-condition-critical/[0.05]",
  needs_attention: "bg-condition-attention/[0.04]",
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

export const dateToneClass: Record<DateTone, string> = {
  attention: "text-condition-attention",
  muted: "text-muted-foreground",
  today: "text-brand-accent-foreground",
};
