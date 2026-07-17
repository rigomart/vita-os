import type { Condition } from "@convex/lib/condition";

import { addDays, format } from "date-fns";

export const DAY = 24 * 60 * 60 * 1000;

export interface DashboardArea {
  condition: Condition;
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

export interface DashboardThreadGroups {
  open: DashboardThread[];
  overdue: DashboardThread[];
  upcoming: DashboardThread[];
  withNextMoves: DashboardThread[];
}

export type ScheduleTarget =
  | "now"
  | "tomorrow"
  | "soon"
  | "weekend"
  | "next-week"
  | "later"
  | "undated";

export interface ScheduleSlot {
  date: number;
  key: Exclude<ScheduleTarget, "undated">;
  label: string;
}

export function groupDashboardThreads(
  threads: DashboardThread[],
  currentDate: number,
): DashboardThreadGroups {
  const today = startOfLocalDay(currentDate);
  const groups: DashboardThreadGroups = {
    overdue: [],
    upcoming: [],
    withNextMoves: [],
    open: [],
  };

  for (const thread of threads) {
    if (thread.followUp != null) {
      if (startOfLocalDay(thread.followUp) < today) {
        groups.overdue.push(thread);
      } else {
        groups.upcoming.push(thread);
      }
    } else if (thread.nextMove) {
      groups.withNextMoves.push(thread);
    } else {
      groups.open.push(thread);
    }
  }

  groups.overdue.sort(compareFollowUps);
  groups.upcoming.sort(compareFollowUps);
  return groups;
}

export function getScheduleSlots(currentDate: number): ScheduleSlot[] {
  const today = startOfLocalDay(currentDate);
  const saturday = nextWeekday(today, 6);
  const nextMonday = addDays(new Date(saturday), 2).getTime();

  return [
    { key: "now", label: "Now", date: today },
    {
      key: "tomorrow",
      label: format(addDays(new Date(today), 1), "EEE d"),
      date: addDays(new Date(today), 1).getTime(),
    },
    {
      key: "soon",
      label: format(addDays(new Date(today), 2), "EEE d"),
      date: addDays(new Date(today), 2).getTime(),
    },
    { key: "weekend", label: "Weekend", date: saturday },
    { key: "next-week", label: "Next week", date: nextMonday },
    {
      key: "later",
      label: "Later",
      date: addDays(new Date(today), 30).getTime(),
    },
  ];
}

export function getScheduleTarget(
  timestamp: number | undefined,
  currentDate: number,
): ScheduleTarget {
  if (timestamp == null) return "undated";

  const slots = getScheduleSlots(currentDate);
  const day = startOfLocalDay(timestamp);
  const [, tomorrow, soon, , nextWeek] = slots;

  if (day <= startOfLocalDay(currentDate)) return "now";
  if (day <= tomorrow.date) return "tomorrow";
  if (day <= soon.date) return "soon";
  if (day < nextWeek.date) return "weekend";
  if (day < nextWeek.date + 7 * DAY) return "next-week";
  return "later";
}

export function followUpDateLabel(timestamp: number, currentDate: number) {
  const difference = dayDifference(timestamp, currentDate);
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  return format(new Date(timestamp), "MMM d");
}

export function taskDateLabel(timestamp: number, currentDate: number) {
  const difference = dayDifference(timestamp, currentDate);
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  if (difference === -1) return "Yesterday";
  if (difference < 0) return `${Math.abs(difference)} days ago`;
  if (difference <= 7) return `In ${difference} days`;
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

function compareFollowUps(a: DashboardThread, b: DashboardThread) {
  return (a.followUp ?? 0) - (b.followUp ?? 0);
}

function dayDifference(timestamp: number, currentDate: number) {
  return Math.round(
    (startOfLocalDay(timestamp) - startOfLocalDay(currentDate)) / DAY,
  );
}

function nextWeekday(timestamp: number, weekday: number) {
  const date = new Date(timestamp);
  const offset = (weekday - date.getDay() + 7) % 7 || 7;
  return addDays(date, offset).getTime();
}
