import type { AreaIcon } from "@convex/lib/areaIcons";
import type { Condition } from "@convex/lib/condition";
import type {
  ProjectedArea,
  ProjectedNote,
  ProjectedThread,
} from "@convex/lib/validators";

import { format } from "date-fns";

export const DAY = 24 * 60 * 60 * 1000;

export interface DashboardArea {
  condition: Condition;
  icon: AreaIcon;
  id: string;
  name: string;
  order: number;
  slug: string;
  /** The Area's Standard, read-only here — the Quick Panel shows it verbatim. */
  standard?: string;
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

export interface DashboardInboxNote {
  createdAt: number;
  id: string;
  body: string;
  when?: number;
}

export function toDashboardArea(doc: ProjectedArea): DashboardArea {
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    condition: doc.condition,
    icon: doc.icon,
    order: doc.order,
    standard: doc.standard,
  };
}

export function toDashboardThread(doc: ProjectedThread): DashboardThread {
  return {
    id: doc._id,
    title: doc.title,
    slug: doc.slug,
    summary: doc.summary,
    areaId: doc.areaId,
    nextMove: doc.nextMove,
    followUp: doc.followUp,
    lastActivityAt: doc.lastActivityAt,
    lastActivityContent: doc.lastActivityContent,
    order: doc.order,
  };
}

export function toDashboardNote(doc: ProjectedNote): DashboardInboxNote {
  return {
    id: doc._id,
    body: doc.body,
    when: doc.when,
    createdAt: doc.createdAt,
  };
}

export function followUpDateLabel(timestamp: number, currentDate: number) {
  const difference = dayDelta(timestamp, currentDate);
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  return format(new Date(timestamp), "MMM d");
}

/** Whole local days from today to `timestamp` (negative means past). */
export function dayDelta(timestamp: number, currentDate: number) {
  return Math.round(
    (startOfLocalDay(timestamp) - startOfLocalDay(currentDate)) / DAY,
  );
}

/** Whole local days since `timestamp`, never negative. */
export function daysSince(timestamp: number, currentDate: number) {
  return Math.max(0, -dayDelta(timestamp, currentDate));
}

/** A compact, humane annotation for a soft attention date. */
export function relativeDayLabel(timestamp: number, currentDate: number) {
  const difference = dayDelta(timestamp, currentDate);
  if (difference < -1) return `${-difference}d late`;
  if (difference === -1) return "Yesterday";
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  if (difference <= 6) return format(new Date(timestamp), "EEE");
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
