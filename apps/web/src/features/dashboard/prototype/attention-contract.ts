// PROTOTYPE — throwaway (issue #309). Shared data contract for the
// attention-first dashboard variants. Every variant receives the same
// `AttentionDashboardProps` and derives from these helpers so the variants
// stay comparable; layout and rendering are entirely per-variant. Delete
// features/dashboard/prototype/ wholesale once the round is decided —
// nothing outside this folder may import from it.

import type { Condition } from "@convex/lib/condition";

import { groupThreadsByAttention } from "@convex/lib/attentionOrdering";
import { format } from "date-fns";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "../components/dashboard-model";

import { DAY, startOfLocalDay } from "../components/dashboard-model";

export interface AttentionDashboardProps {
  areas: DashboardArea[];
  currentDate: number;
  tasks: DashboardInboxTask[];
  threads: DashboardThread[];
}

export type AttentionGroup = "nextMove" | "open" | "overdue" | "upcoming";

export interface AttentionEntry {
  area?: DashboardArea;
  group: AttentionGroup;
  thread: DashboardThread;
}

/**
 * The Dashboard's canonical flat run: Overdue Follow-ups → Upcoming
 * Follow-ups → Threads with Next Moves → plain Open Threads. Position is the
 * attention engine's alone — variants must not reorder by date.
 */
export function buildAttentionRun(
  threads: DashboardThread[],
  areas: DashboardArea[],
  currentDate: number,
): AttentionEntry[] {
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const groups = groupThreadsByAttention(threads, currentDate);
  const entry =
    (group: AttentionGroup) =>
    (thread: DashboardThread): AttentionEntry => ({
      area: areaById.get(thread.areaId),
      group,
      thread,
    });
  return [
    ...groups.overdue.map(entry("overdue")),
    ...groups.upcoming.map(entry("upcoming")),
    ...groups.withNextMoves.map(entry("nextMove")),
    ...groups.open.map(entry("open")),
  ];
}

/**
 * Backward time: how long since the Thread's Activity Log last moved.
 * 0 = fresh (under 7d, or no record — absence of data is not neglect),
 * 1 = quiet (7–21d), 2 = fading (21–45d), 3 = dormant (45d+).
 */
export type StalenessLevel = 0 | 1 | 2 | 3;

export function stalenessLevel(
  thread: DashboardThread,
  currentDate: number,
): StalenessLevel {
  const days = daysSinceActivity(thread, currentDate);
  if (days === undefined) return 0;
  if (days >= 45) return 3;
  if (days >= 21) return 2;
  if (days >= 7) return 1;
  return 0;
}

export function daysSinceActivity(
  thread: DashboardThread,
  currentDate: number,
): number | undefined {
  if (thread.lastActivityAt === undefined) return undefined;
  return Math.max(0, Math.round((currentDate - thread.lastActivityAt) / DAY));
}

/** Whole local days from today to `timestamp` (negative = past). */
export function dayDelta(timestamp: number, currentDate: number): number {
  return Math.round(
    (startOfLocalDay(timestamp) - startOfLocalDay(currentDate)) / DAY,
  );
}

/** "3d late" | "Yesterday" | "Today" | "Tomorrow" | "Thu" (≤6d out) | "May 25". */
export function relativeDayLabel(
  timestamp: number,
  currentDate: number,
): string {
  const delta = dayDelta(timestamp, currentDate);
  if (delta < -1) return `${-delta}d late`;
  if (delta === -1) return "Yesterday";
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta <= 6) return format(new Date(timestamp), "EEE");
  return format(new Date(timestamp), "MMM d");
}

export interface HorizonDot {
  /** The owning Area's Condition for threads; undefined for Inbox tasks. */
  condition?: Condition;
  date: number;
  dayDelta: number;
  id: string;
  kind: "task" | "thread";
  label: string;
  threadSlug?: string;
}

export interface HorizonDay {
  date: number;
  dayDelta: number;
  dots: HorizonDot[];
}

export interface HorizonModel {
  /** Dated beyond the horizon window, soonest first. */
  beyond: HorizonDot[];
  /** Every day from today (dayDelta 0) through horizonDays - 1. */
  days: HorizonDay[];
  /** Past-dated items, oldest first. */
  overdue: HorizonDot[];
}

/**
 * Forward time as data: every dated Follow-up and Task "When" bucketed by
 * local day. How a variant draws this — ribbon, gutter, anything — is its
 * own business; the buckets keep the variants honest about the same facts.
 */
export function buildHorizon(
  { areas, currentDate, tasks, threads }: AttentionDashboardProps,
  horizonDays = 28,
): HorizonModel {
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const dots: HorizonDot[] = [];

  for (const thread of threads) {
    if (thread.followUp === undefined) continue;
    dots.push({
      condition: areaById.get(thread.areaId)?.condition,
      date: startOfLocalDay(thread.followUp),
      dayDelta: dayDelta(thread.followUp, currentDate),
      id: thread.id,
      kind: "thread",
      label: thread.title,
      threadSlug: thread.slug,
    });
  }
  for (const task of tasks) {
    if (task.when === undefined) continue;
    dots.push({
      date: startOfLocalDay(task.when),
      dayDelta: dayDelta(task.when, currentDate),
      id: task.id,
      kind: "task",
      label: task.text,
    });
  }

  const today = startOfLocalDay(currentDate);
  const days: HorizonDay[] = Array.from({ length: horizonDays }, (_, i) => ({
    date: today + i * DAY,
    dayDelta: i,
    dots: [],
  }));
  const overdue: HorizonDot[] = [];
  const beyond: HorizonDot[] = [];

  for (const dot of dots) {
    if (dot.dayDelta < 0) overdue.push(dot);
    else if (dot.dayDelta >= horizonDays) beyond.push(dot);
    else days[dot.dayDelta]?.dots.push(dot);
  }
  overdue.sort((a, b) => a.date - b.date);
  beyond.sort((a, b) => a.date - b.date);

  return { beyond, days, overdue };
}
