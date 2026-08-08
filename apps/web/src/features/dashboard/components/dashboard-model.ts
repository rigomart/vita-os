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

export interface DashboardRecentActivity {
  content: string;
  createdAt: number;
  id: string;
  threadId: string;
}

export interface DashboardOverviewData {
  areas: DashboardArea[];
  inbox: {
    items: DashboardInboxTask[];
    totalOpen: number;
  };
  recentActivity: DashboardRecentActivity[];
  threads: DashboardThread[];
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
