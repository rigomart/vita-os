import type { MockArea } from "../mock-data";

import { mockAreaById, mockTasks, mockThreads, NOW } from "../mock-data";

/**
 * Data model for the "Weekly ritual" Plan exploration.
 *
 * One planning surface holds two different domain objects, so they collapse
 * into a single {@link PlanItem} with a `kind` discriminator:
 *
 * - a **Thread** carries an Area, at most one **Next Move**, and a soft
 *   **Follow-up** date;
 * - an inbox **Task** carries neither Area nor Thread, only a soft **When**.
 *
 * `when` is whichever soft date the item has. Nothing here is a deadline:
 * a passed date means "waiting for you to re-engage", never "late".
 */

export type PlanItemKind = "task" | "thread";

export interface PlanItem {
  /** Threads only. */
  areaId?: string;
  /** Sort key for the Inbox Tasks tray group (oldest first). */
  createdAt: number;
  id: string;
  kind: PlanItemKind;
  /** Threads only, and at most one — never a subtask list. */
  nextMove?: string;
  nextMoveDone?: boolean;
  /** Resolved Thread / completed Task: gone from the surface, kept for undo. */
  resolved?: boolean;
  /** Threads only. */
  summary?: string;
  title: string;
  /** Thread Follow-up or Task When. Soft, clearable, never a deadline. */
  when?: number;
}

export const WEEK_LENGTH = 7;

/** The hour a dropped/keyed date lands on, so it reads as "that morning". */
const DEFAULT_HOUR = 9;

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** Calendar-day arithmetic, so DST never shifts a bucket. */
export function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

export function dayTimestamp(offsetFromToday: number): number {
  const today = new Date(NOW);
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + offsetFromToday,
    DEFAULT_HOUR,
  ).getTime();
}

/** Whole calendar days a soft date has been sitting in the past. */
export function daysLate(when: number, now: number): number {
  return Math.round(
    (startOfLocalDay(now) - startOfLocalDay(when)) / (24 * 60 * 60 * 1000),
  );
}

export function isOverdue(item: PlanItem, now: number): boolean {
  return item.when !== undefined && daysLate(item.when, now) > 0;
}

export function areaOf(item: PlanItem): MockArea | undefined {
  return item.areaId === undefined ? undefined : mockAreaById.get(item.areaId);
}

/** Seeds local state once. Never mutated — every update derives a new array. */
export function buildInitialItems(): PlanItem[] {
  const threads: PlanItem[] = mockThreads.map((thread) => ({
    areaId: thread.areaId,
    createdAt: thread.lastActivity?.createdAt ?? NOW,
    id: thread.id,
    kind: "thread",
    nextMove: thread.nextMove,
    summary: thread.summary,
    title: thread.title,
    when: thread.followUp,
  }));

  const tasks: PlanItem[] = mockTasks.map((task) => ({
    createdAt: task.createdAt,
    id: task.id,
    kind: "task",
    title: task.text,
    when: task.when,
  }));

  return [...threads, ...tasks];
}

// --- The tray: everything that still wants a decision ----------------------

export type TrayGroupKey = "actionable" | "overdue" | "plain" | "tasks";

export interface TrayGroup {
  /** One line explaining what the decision on this pile actually is. */
  hint: string;
  items: PlanItem[];
  key: TrayGroupKey;
  label: string;
}

const TRAY_ORDER: TrayGroupKey[] = ["overdue", "actionable", "plain", "tasks"];

const TRAY_META: Record<TrayGroupKey, { hint: string; label: string }> = {
  actionable: {
    hint: "A move is ready. It just has no day.",
    label: "Ready, unscheduled",
  },
  overdue: {
    hint: "These dates passed without you re-engaging.",
    label: "Needs re-triage",
  },
  plain: {
    hint: "No move, no date. Does this still matter?",
    label: "Open, undecided",
  },
  tasks: {
    hint: "Loose tasks waiting for a when.",
    label: "Inbox tasks",
  },
};

/**
 * Buckets every unfinished item into the four piles the ritual works through.
 * Anything already sitting on a future day is planned, so it stays out.
 */
export function buildTray(items: PlanItem[], now: number): TrayGroup[] {
  const buckets: Record<TrayGroupKey, PlanItem[]> = {
    actionable: [],
    overdue: [],
    plain: [],
    tasks: [],
  };

  for (const item of items) {
    const stale = isOverdue(item, now);

    if (item.kind === "task") {
      if (stale || item.when === undefined) buckets.tasks.push(item);
      continue;
    }

    if (stale) {
      buckets.overdue.push(item);
      continue;
    }
    if (item.when !== undefined) continue;

    if (item.nextMove && !item.nextMoveDone) buckets.actionable.push(item);
    else buckets.plain.push(item);
  }

  buckets.overdue = [...buckets.overdue].sort(
    (a, b) => (a.when ?? 0) - (b.when ?? 0),
  );
  buckets.tasks = [...buckets.tasks].sort((a, b) => a.createdAt - b.createdAt);

  return TRAY_ORDER.map((key) => ({
    ...TRAY_META[key],
    items: buckets[key],
    key,
  }));
}

/** Flat review queue, in tray order — the pile you work top to bottom. */
export function trayQueue(groups: TrayGroup[]): string[] {
  return groups.flatMap((group) => group.items.map((item) => item.id));
}

// --- The week: seven days plus two escape hatches ---------------------------

export interface WeekDay {
  date: Date;
  /** 0 is today. */
  index: number;
  items: PlanItem[];
}

export interface WeekModel {
  beyond: PlanItem[];
  days: WeekDay[];
  /** Count only — undated items live in the tray, not duplicated here. */
  somedayCount: number;
}

export function buildWeek(items: PlanItem[], now: number): WeekModel {
  const today = new Date(now);
  const days: WeekDay[] = Array.from({ length: WEEK_LENGTH }, (_, index) => ({
    date: addDays(today, index),
    index,
    items: [],
  }));
  const dayStarts = days.map((day) => day.date.getTime());
  const beyondStart = addDays(today, WEEK_LENGTH).getTime();

  const beyond: PlanItem[] = [];
  let somedayCount = 0;

  for (const item of items) {
    if (item.when === undefined) {
      somedayCount += 1;
      continue;
    }
    const start = startOfLocalDay(item.when);
    if (start >= beyondStart) {
      beyond.push(item);
      continue;
    }
    const index = dayStarts.indexOf(start);
    if (index >= 0) days[index].items.push(item);
    // Anything earlier is overdue: it belongs to the tray, not to a day.
  }

  const byWhen = (a: PlanItem, b: PlanItem) => (a.when ?? 0) - (b.when ?? 0);

  return {
    beyond: [...beyond].sort(byWhen),
    days: days.map((day) => ({ ...day, items: [...day.items].sort(byWhen) })),
    somedayCount,
  };
}

// --- Drop targets ----------------------------------------------------------

export const BEYOND_TARGET = "beyond";
export const SOMEDAY_TARGET = "someday";

export function dayTarget(index: number): string {
  return `day:${index}`;
}

/** Resolves a droppable id to the soft date a drop there should write. */
export function targetWhen(
  target: string,
): { when: number | undefined } | undefined {
  if (target === SOMEDAY_TARGET) return { when: undefined };
  if (target === BEYOND_TARGET) return { when: dayTimestamp(WEEK_LENGTH) };
  if (target.startsWith("day:")) {
    const index = Number(target.slice(4));
    if (Number.isInteger(index)) return { when: dayTimestamp(index) };
  }
  return undefined;
}
