import type { MockActivity } from "../mock-data";

import { DAY, mockTasks, mockThreads } from "../mock-data";

/**
 * Flow timeline model.
 *
 * One flat list of planable items (Threads keyed by Follow-up, Inbox Tasks
 * keyed by When) projected onto a continuous run of local days: an overdue
 * zone, the next {@link HORIZON_DAYS} days, then Later and No date.
 */

export type PlanItemKind = "task" | "thread";

export interface PlanItem {
  areaId?: string;
  /** Tasks only: when it was captured into the Inbox. */
  createdAt?: number;
  /** Follow-up (Thread) or When (Task). Undefined = no date. */
  date?: number;
  id: string;
  kind: PlanItemKind;
  lastActivity?: MockActivity;
  /** Threads only, and at most one. */
  nextMove?: string;
  summary?: string;
  title: string;
}

/** Days rendered day-by-day before everything collapses into "Later". */
export const HORIZON_DAYS = 14;

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

// --- dates ------------------------------------------------------------------

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Whole local days from `now` to `timestamp` (negative = in the past). */
export function dayOffsetFrom(timestamp: number, now: number): number {
  return Math.round((startOfDay(timestamp) - startOfDay(now)) / DAY);
}

/** `offset` days from `now`, at a sensible resurfacing hour. */
export function dayAt(offset: number, now: number, hour = 9): number {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

export type QuickTarget = "next-week" | "today" | "tomorrow" | "weekend";

export const quickTargets: { key: QuickTarget; label: string; hint: string }[] =
  [
    { key: "today", label: "Today", hint: "T" },
    { key: "tomorrow", label: "Tomorrow", hint: "M" },
    { key: "weekend", label: "Weekend", hint: "E" },
    { key: "next-week", label: "Next week", hint: "W" },
  ];

/** Resolve a quick chip to a concrete Follow-up timestamp. */
export function quickDate(target: QuickTarget, now: number): number {
  const today = new Date(now);

  switch (target) {
    case "today":
      return dayAt(0, now, 17);
    case "tomorrow":
      return dayAt(1, now);
    case "weekend": {
      // Upcoming Saturday; if today is Saturday, this weekend still means today.
      const offset = (6 - today.getDay() + 7) % 7;
      return dayAt(offset, now, 10);
    }
    case "next-week": {
      const offset = (1 - today.getDay() + 7) % 7 || 7;
      return dayAt(offset, now);
    }
  }
}

// --- timeline ---------------------------------------------------------------

export type Section =
  | {
      date: number;
      id: string;
      items: PlanItem[];
      kind: "day";
      offset: number;
    }
  | { id: string; items: PlanItem[]; kind: "later" | "overdue" | "undated" };

export const OVERDUE_ID = "zone-overdue";
export const LATER_ID = "zone-later";
export const UNDATED_ID = "zone-undated";

function byDateThenTitle(a: PlanItem, b: PlanItem): number {
  const left = a.date ?? 0;
  const right = b.date ?? 0;
  if (left !== right) return left - right;
  return a.title.localeCompare(b.title);
}

export function buildSections(items: PlanItem[], now: number): Section[] {
  const overdue: PlanItem[] = [];
  const later: PlanItem[] = [];
  const undated: PlanItem[] = [];
  const byDay = new Map<number, PlanItem[]>();

  for (const item of items) {
    if (item.date === undefined) {
      undated.push(item);
      continue;
    }

    const offset = dayOffsetFrom(item.date, now);
    if (offset < 0) {
      overdue.push(item);
    } else if (offset >= HORIZON_DAYS) {
      later.push(item);
    } else {
      const bucket = byDay.get(offset);
      if (bucket) bucket.push(item);
      else byDay.set(offset, [item]);
    }
  }

  const days: Section[] = Array.from({ length: HORIZON_DAYS }, (_, offset) => ({
    date: dayAt(offset, now),
    id: `day-${offset}`,
    items: [...(byDay.get(offset) ?? [])].sort(byDateThenTitle),
    kind: "day",
    offset,
  }));

  return [
    {
      id: OVERDUE_ID,
      items: [...overdue].sort(byDateThenTitle),
      kind: "overdue",
    },
    ...days,
    { id: LATER_ID, items: [...later].sort(byDateThenTitle), kind: "later" },
    {
      id: UNDATED_ID,
      items: [...undated].sort((a, b) => a.title.localeCompare(b.title)),
      kind: "undated",
    },
  ];
}

/** Top-to-bottom item ids — the order j/k walks. */
export function flattenOrder(sections: Section[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.id));
}

/** Where a drop on `sectionId` should land the item's date. */
export function dropDate(sectionId: string, now: number): number | undefined {
  if (sectionId === UNDATED_ID) return undefined;
  if (sectionId === LATER_ID) return dayAt(HORIZON_DAYS + 7, now);
  const offset = Number(sectionId.replace("day-", ""));
  return Number.isNaN(offset) ? undefined : dayAt(offset, now);
}

// --- labels -----------------------------------------------------------------

const RELATIVE_DAY_LABELS: Record<number, string> = {
  0: "Today",
  1: "Tomorrow",
};

export function dayLabel(offset: number): string | undefined {
  return RELATIVE_DAY_LABELS[offset];
}

/** "4 days late", for the overdue zone. */
export function latenessLabel(date: number, now: number): string {
  const days = -dayOffsetFrom(date, now);
  if (days === 1) return "1 day late";
  return `${days} days late`;
}

/** "3d ago" / "today", for lastActivity whispers. */
export function agoLabel(timestamp: number, now: number): string {
  const days = -dayOffsetFrom(timestamp, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
