import type { AreaIcon } from "@convex/lib/areaIcons";
import type { Condition } from "@convex/lib/condition";
import type {
  ProjectedArea,
  ProjectedTask,
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

export function toDashboardArea(doc: ProjectedArea): DashboardArea {
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    condition: doc.condition,
    icon: doc.icon,
    order: doc.order,
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

export function toDashboardTask(doc: ProjectedTask): DashboardInboxTask {
  return {
    id: doc._id,
    text: doc.text,
    when: doc.when,
    createdAt: doc.createdAt,
  };
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
