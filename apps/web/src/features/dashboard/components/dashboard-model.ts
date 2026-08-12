import type { Doc } from "@convex/_generated/dataModel";
import type { AreaIcon } from "@convex/lib/areaIcons";
import type { Condition } from "@convex/lib/condition";

import { format } from "date-fns";

export const DAY = 24 * 60 * 60 * 1000;

export interface DashboardArea {
  condition: Condition;
  icon?: AreaIcon;
  id: string;
  name: string;
  order: number;
  slug: string;
}

export interface DashboardThread {
  areaId: string;
  followUp?: number;
  id: string;
  lastActivityAt?: number;
  lastActivityContent?: string;
  nextMove?: string;
  order: number;
  slug: string;
  summary?: string;
  title: string;
}

export interface DashboardInboxTask {
  createdAt: number;
  id: string;
  text: string;
  when?: number;
}

/** A Thread the recent-activity strip can render: both stamps are present. */
export type DashboardThreadWithActivity = DashboardThread & {
  lastActivityAt: number;
  lastActivityContent: string;
};

export function toDashboardArea(doc: Doc<"areas">): DashboardArea {
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug ?? doc._id,
    condition: doc.condition,
    icon: doc.icon,
    order: doc.order,
  };
}

export function toDashboardThread(doc: Doc<"threads">): DashboardThread {
  return {
    id: doc._id,
    title: doc.title,
    slug: doc.slug ?? doc._id,
    summary: doc.summary,
    areaId: doc.areaId,
    nextMove: doc.nextMove,
    followUp: doc.followUp,
    lastActivityAt: doc.lastActivityAt,
    lastActivityContent: doc.lastActivityContent,
    order: doc.order,
  };
}

export function toDashboardTask(doc: Doc<"tasks">): DashboardInboxTask {
  return {
    id: doc._id,
    text: doc.text,
    when: doc.when,
    createdAt: doc.createdAt,
  };
}

/**
 * Enough to fill the Dashboard's full-width activity strip at two rows of
 * three.
 */
export const RECENT_ACTIVITY_CAP = 6;

/**
 * The Threads the recent-activity strip shows: newest activity first, one
 * entry per Thread by construction — the activity lives on the Thread itself.
 */
export function recentActivity(
  threads: DashboardThread[],
  cap: number = RECENT_ACTIVITY_CAP,
): DashboardThreadWithActivity[] {
  return threads
    .filter(
      (thread): thread is DashboardThreadWithActivity =>
        thread.lastActivityAt !== undefined &&
        thread.lastActivityContent !== undefined,
    )
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .slice(0, cap);
}

export function followUpDateLabel(timestamp: number, currentDate: number) {
  const difference = dayDifference(timestamp, currentDate);
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  return format(new Date(timestamp), "MMM d");
}

export function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function dayDifference(timestamp: number, currentDate: number) {
  return Math.round(
    (startOfLocalDay(timestamp) - startOfLocalDay(currentDate)) / DAY,
  );
}
