import type { Condition } from "@convex/lib/condition";

import { addDays, format, startOfDay } from "date-fns";

import type { MockActivity, MockArea } from "../mock-data";

import { DAY, mockAreas, mockTasks, mockThreads } from "../mock-data";

/**
 * Model for the converged Plan view.
 *
 * The canvas is an Area × time grid. Rows are Life Areas ordered worst
 * condition first, plus one pinned Inbox row for Tasks (which have no Area).
 * Columns are fuzzy time horizons, and each one owns a **landing date** — the
 * exact soft date a drop assigns — so a drag is never a surprise.
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
  | "today";

export type ColumnTone = "attention" | "now" | "quiet" | "soon";

/** What dropping onto a column does to the item's soft date. */
export type DropAction = "clear" | "schedule" | null;

export interface PlanColumn {
  /** Landing-date contract, printed in the header. */
  caption: string;
  drop: DropAction;
  /** The exact date written on drop; undefined when `drop` clears. */
  dropAt?: number;
  key: ColumnKey;
  label: string;
  tone: ColumnTone;
}

export function columnFor(date: number | undefined, now: number): ColumnKey {
  if (date == null) return "none";

  const delta = dayDelta(date, now);
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";

  const restOfWeek = daysLeftThisWeek(now);
  if (delta <= restOfWeek) return "this-week";
  if (delta <= restOfWeek + 7) return "next-week";
  return "later";
}

/**
 * Visible columns, left to right.
 *
 * Overdue only earns a column when something is actually late, and it is never
 * a drop target — you cannot schedule into the past.
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
      tone: "attention",
    });
  }

  columns.push({
    key: "today",
    label: "Today",
    caption: format(new Date(now), "EEE d MMM"),
    drop: "schedule",
    dropAt: dayAt(0, now, 17),
    tone: "now",
  });

  if (restOfWeek >= 1) {
    columns.push({
      key: "this-week",
      label: "This week",
      caption: landingCaption(dayAt(1, now)),
      drop: "schedule",
      dropAt: dayAt(1, now),
      tone: "soon",
    });
  }

  columns.push(
    {
      key: "next-week",
      label: "Next week",
      caption: landingCaption(dayAt(restOfWeek + 1, now)),
      drop: "schedule",
      dropAt: dayAt(restOfWeek + 1, now),
      tone: "soon",
    },
    {
      key: "later",
      label: "Later",
      caption: landingCaption(dayAt(restOfWeek + 8, now)),
      drop: "schedule",
      dropAt: dayAt(restOfWeek + 8, now),
      tone: "quiet",
    },
    {
      key: "none",
      label: "No date",
      caption: "clears the date",
      drop: "clear",
      tone: "quiet",
    },
  );

  return columns;
}

function landingCaption(at: number): string {
  return `lands ${format(new Date(at), "EEE d")}`;
}

export const columnKeys: ColumnKey[] = [
  "overdue",
  "today",
  "this-week",
  "next-week",
  "later",
  "none",
];

function emptyCells(): Record<ColumnKey, PlanItem[]> {
  return {
    overdue: [],
    today: [],
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
      nearHorizon: cells.today.length + cells["this-week"].length,
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
  const totals: Record<ColumnKey, number> = {
    overdue: 0,
    today: 0,
    "this-week": 0,
    "next-week": 0,
    later: 0,
    none: 0,
  };

  for (const cells of cellSets) {
    for (const key of columnKeys) totals[key] += cells[key].length;
  }

  return totals;
}

/* ------------------------------------------------------ the review queue -- */

export type QueueGroupKey = "inbox" | "ready" | "retriage" | "undecided";

export interface QueueGroup {
  /** The decision this pile is actually asking for. */
  hint: string;
  items: PlanItem[];
  key: QueueGroupKey;
  label: string;
}

const QUEUE_META: Record<QueueGroupKey, { hint: string; label: string }> = {
  retriage: {
    hint: "These dates passed without you re-engaging.",
    label: "Needs re-triage",
  },
  ready: {
    hint: "A move is ready. It just has no day.",
    label: "Ready, unscheduled",
  },
  undecided: {
    hint: "No move, no date. Does this still matter?",
    label: "Open, undecided",
  },
  inbox: {
    hint: "Loose tasks waiting for a when.",
    label: "Inbox tasks",
  },
};

const QUEUE_ORDER: QueueGroupKey[] = [
  "retriage",
  "ready",
  "undecided",
  "inbox",
];

/**
 * Everything still waiting on a decision, grouped by the decision being asked.
 * Anything already sitting on a future day is planned, so it stays out.
 */
export function buildQueue(items: PlanItem[], now: number): QueueGroup[] {
  const buckets: Record<QueueGroupKey, PlanItem[]> = {
    inbox: [],
    ready: [],
    retriage: [],
    undecided: [],
  };

  for (const item of items) {
    const overdue = item.date != null && dayDelta(item.date, now) < 0;

    if (item.kind === "task") {
      if (overdue || item.date == null) buckets.inbox.push(item);
      continue;
    }
    if (overdue) {
      buckets.retriage.push(item);
      continue;
    }
    if (item.date != null) continue;
    if (item.nextMove) buckets.ready.push(item);
    else buckets.undecided.push(item);
  }

  buckets.retriage.sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
  buckets.inbox.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  return QUEUE_ORDER.map((key) => ({
    ...QUEUE_META[key],
    items: buckets[key],
    key,
  }));
}

export function queueIds(groups: QueueGroup[]): string[] {
  return groups.flatMap((group) => group.items.map((item) => item.id));
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
  if (column === "today" || column === "this-week") {
    return format(new Date(date), "EEE");
  }
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

/** Seven days from today, for the review's schedule row. */
export const REVIEW_WEEK = 7;

export function reviewDays(items: PlanItem[], now: number) {
  const base = startOfDay(new Date(now));
  return Array.from({ length: REVIEW_WEEK }, (_, index) => {
    const date = addDays(base, index);
    const load = items.filter(
      (item) => item.date != null && dayDelta(item.date, now) === index,
    ).length;
    return { date, index, load };
  });
}
