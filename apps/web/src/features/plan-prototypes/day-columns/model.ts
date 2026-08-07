import type { Condition } from "@convex/lib/condition";

import { format, startOfDay } from "date-fns";

import type { MockActivity, MockArea } from "../mock-data";

import { DAY, mockAreas, mockTasks, mockThreads } from "../mock-data";

/**
 * Model for the **Day columns** Plan variation.
 *
 * Same canvas as the base — Areas as rows, worst condition first, plus a pinned
 * Inbox row — but the time axis is literal: every column is one real calendar
 * day. There is no bucket to interpret, so a drop can only mean one thing, and
 * the chip no longer has to carry a date stamp (the column already is the date).
 *
 * The far future is the one thing a day axis cannot show. It collapses into a
 * single **Beyond** column, and dropping there opens a day picker at the drop
 * point — so even the overflow resolves to an exact date, never to a guess.
 *
 * Everything here is pure; nothing from `mock-data` is ever mutated.
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
/** Today plus the next six days. One week of columns is the whole design. */
export const VISIBLE_DAYS = 7;

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

/** Resolve a quick key to a concrete soft date. */
export function quickDate(target: QuickTarget, now: number): number {
  const today = new Date(now);

  switch (target) {
    case "today":
      return dayAt(0, now, 17);
    case "tomorrow":
      return dayAt(1, now);
    case "weekend":
      // The upcoming Saturday; on a Saturday, "this weekend" is still today.
      return dayAt((6 - today.getDay() + 7) % 7, now, 10);
    case "next-week":
      return dayAt(daysLeftThisWeek(now) + 1, now);
  }
}

/**
 * The three one-tap dates offered by the Beyond picker: the first three Mondays
 * that fall outside the visible week. Mondays because a far-future soft date is
 * a "pick up the thread again" marker, and weeks are how people say it.
 */
export function beyondShortcuts(now: number): { at: number; label: string }[] {
  let offset = VISIBLE_DAYS;
  while (new Date(dayAt(offset, now)).getDay() !== 1) offset += 1;

  return [0, 7, 14].map((step) => {
    const at = dayAt(offset + step, now);
    return { at, label: format(new Date(at), "EEE d MMM") };
  });
}

/* --------------------------------------------------------------- columns -- */

export const OVERDUE_KEY = "overdue";
export const BEYOND_KEY = "beyond";
export const NO_DATE_KEY = "none";

export type ColumnKey = string;
export type ColumnKind = "beyond" | "day" | "none" | "overdue";

/** What dropping onto a column does. `pick` asks for the exact day first. */
export type DropAction = "clear" | "pick" | "schedule" | null;

export interface PlanColumn {
  /** The `d` of "Fri 7", or "1 Sep" on a month boundary. Day columns only. */
  dayNumber?: string;
  drop: DropAction;
  /** The exact date written on drop. Day columns only. */
  dropAt?: number;
  isToday?: boolean;
  isWeekend?: boolean;
  key: ColumnKey;
  kind: ColumnKind;
  /** "Today", "Fri", "Overdue", "Beyond", "No date". */
  label: string;
}

export function dayColumnKey(offset: number): ColumnKey {
  return `d${offset}`;
}

export function columnFor(date: number | undefined, now: number): ColumnKey {
  if (date == null) return NO_DATE_KEY;

  const delta = dayDelta(date, now);
  if (delta < 0) return OVERDUE_KEY;
  if (delta < VISIBLE_DAYS) return dayColumnKey(delta);
  return BEYOND_KEY;
}

/**
 * Visible columns, left to right.
 *
 * Overdue only earns a column when something is actually late, and it is never
 * a drop target — you cannot schedule into the past.
 */
export function buildColumns(now: number, hasOverdue: boolean): PlanColumn[] {
  const columns: PlanColumn[] = [];

  if (hasOverdue) {
    columns.push({
      drop: null,
      key: OVERDUE_KEY,
      kind: "overdue",
      label: "Overdue",
    });
  }

  for (let offset = 0; offset < VISIBLE_DAYS; offset += 1) {
    // Today lands at 17:00 the way "later today" actually means it; every
    // other day lands at the morning resurfacing hour.
    const at = dayAt(offset, now, offset === 0 ? 17 : LANDING_HOUR);
    const date = new Date(at);
    const weekday = date.getDay();

    columns.push({
      // A day number alone is ambiguous across a month edge, so the first of
      // the month carries its month with it.
      dayNumber:
        date.getDate() === 1 ? format(date, "d MMM") : format(date, "d"),
      drop: "schedule",
      dropAt: at,
      isToday: offset === 0,
      isWeekend: weekday === 0 || weekday === 6,
      key: dayColumnKey(offset),
      kind: "day",
      label: offset === 0 ? "Today" : format(date, "EEE"),
    });
  }

  columns.push(
    { drop: "pick", key: BEYOND_KEY, kind: "beyond", label: "Beyond" },
    { drop: "clear", key: NO_DATE_KEY, kind: "none", label: "No date" },
  );

  return columns;
}

export function allColumnKeys(hasOverdue: boolean): ColumnKey[] {
  const keys: ColumnKey[] = hasOverdue ? [OVERDUE_KEY] : [];
  for (let offset = 0; offset < VISIBLE_DAYS; offset += 1) {
    keys.push(dayColumnKey(offset));
  }
  keys.push(BEYOND_KEY, NO_DATE_KEY);
  return keys;
}

/** Every key that can ever hold an item, overdue included. */
const storageKeys: ColumnKey[] = allColumnKeys(true);

function emptyCells(): Record<ColumnKey, PlanItem[]> {
  const cells: Record<ColumnKey, PlanItem[]> = {};
  for (const key of storageKeys) cells[key] = [];
  return cells;
}

/* ------------------------------------------------------------------ rows -- */

export const INBOX_ROW_ID = "inbox";

export interface AreaRow {
  area: MockArea;
  cells: Record<ColumnKey, PlanItem[]>;
  /**
   * Threads sitting inside the visible week. Overdue is excluded on purpose:
   * an Area whose only dated Thread is already late has nothing planned, it
   * has a debt.
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
    for (const key of storageKeys) cells[key].sort(byDateThenTitle);

    const openCount = storageKeys.reduce(
      (total, key) => total + cells[key].length,
      0,
    );
    let nearHorizon = 0;
    for (let offset = 0; offset < VISIBLE_DAYS; offset += 1) {
      nearHorizon += cells[dayColumnKey(offset)].length;
    }

    return {
      area,
      cells,
      nearHorizon,
      openCount,
      overdueCount: cells[OVERDUE_KEY].length,
      plannedCount: openCount - cells[NO_DATE_KEY].length,
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
  for (const key of storageKeys) cells[key].sort(byDateThenTitle);
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
  const totals: Record<ColumnKey, number> = {};
  for (const key of storageKeys) totals[key] = 0;

  for (const cells of cellSets) {
    for (const key of storageKeys) totals[key] += cells[key].length;
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
      text: item.kind === "task" ? "No when set" : "No Follow-up set",
      tone: "muted",
    };
  }

  const delta = dayDelta(item.date, now);
  if (delta < 0) {
    return {
      text: `Waiting since ${format(new Date(item.date), "EEE, MMM d")}`,
      tone: "attention",
    };
  }
  if (delta === 0) return { text: `${verb} today`, tone: "today" };
  if (delta === 1) return { text: `${verb} tomorrow`, tone: "muted" };

  return {
    text: `${verb} ${format(new Date(item.date), "EEE, MMM d")}`,
    tone: "muted",
  };
}

/**
 * The stamp on a compact chip.
 *
 * Day columns carry the date in the header, so a chip sitting in one says
 * nothing about when — the whole width goes to the title. Only the two columns
 * that *aren't* a single day still need to name their date.
 */
export function chipStamp(
  date: number | undefined,
  columnKind: ColumnKind,
  now: number,
): string | undefined {
  if (date == null) return undefined;
  if (columnKind === "overdue") return `${-dayDelta(date, now)}d`;
  if (columnKind === "beyond") return format(new Date(date), "d MMM");
  return undefined;
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

export const dateToneClass: Record<DateTone, string> = {
  attention: "text-condition-attention",
  muted: "text-muted-foreground",
  today: "text-brand-accent-foreground",
};
