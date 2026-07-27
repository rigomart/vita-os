import type { Doc, Id } from "../_generated/dataModel";
import type { AreaIcon } from "./areaIcons";

import { compareTasksByAttention } from "./attentionOrdering";

export interface DashboardArea {
  condition: Doc<"areas">["condition"];
  icon?: AreaIcon;
  id: Id<"areas">;
  name: string;
  order: number;
  slug: string;
}

export interface DashboardThread {
  areaId: Id<"areas">;
  followUp?: number;
  id: Id<"threads">;
  nextMove?: string;
  order: number;
  slug: string;
  summary?: string;
  title: string;
}

export interface DashboardInboxTask {
  createdAt: number;
  id: Id<"tasks">;
  text: string;
  when?: number;
}

export interface DashboardActivity {
  content: string;
  createdAt: number;
  id: Id<"activityLogs">;
  threadId: Id<"threads">;
}

export interface DashboardSource {
  activityLogs: Doc<"activityLogs">[];
  areas: Doc<"areas">[];
  tasks: Doc<"tasks">[];
  threads: Doc<"threads">[];
}

export function buildDashboardOverview(
  userId: string,
  source: DashboardSource,
  currentDate = Date.now(),
  timezoneOffsetMinutes?: number,
) {
  const areas = source.areas
    .filter((area) => area.userId === userId)
    .sort((a, b) => a.order - b.order)
    .map(
      (area): DashboardArea => ({
        id: area._id,
        name: area.name,
        slug: area.slug ?? area._id,
        condition: area.condition,
        icon: area.icon,
        order: area.order,
      }),
    );

  const openThreads = source.threads
    .filter((thread) => thread.userId === userId && thread.state === "open")
    .sort((a, b) => a.order - b.order);
  const threads = openThreads.map(
    (thread): DashboardThread => ({
      id: thread._id,
      title: thread.title,
      slug: thread.slug ?? thread._id,
      summary: thread.summary,
      areaId: thread.areaId,
      nextMove: thread.nextMove,
      followUp: thread.followUp,
      order: thread.order,
    }),
  );

  const openTasks = source.tasks
    .filter((task) => task.userId === userId && task.state === "open")
    .sort((a, b) =>
      compareTasksByAttention(a, b, currentDate, timezoneOffsetMinutes),
    );

  const openThreadIds = new Set(openThreads.map((thread) => thread._id));
  const seenThreads = new Set<Id<"threads">>();
  const recentActivity: DashboardActivity[] = [];

  for (const entry of source.activityLogs
    .filter((activity) => activity.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)) {
    if (!openThreadIds.has(entry.threadId) || seenThreads.has(entry.threadId)) {
      continue;
    }

    recentActivity.push({
      id: entry._id,
      threadId: entry.threadId,
      content: entry.content,
      createdAt: entry.createdAt,
    });
    seenThreads.add(entry.threadId);
    if (recentActivity.length === 2) break;
  }

  return {
    areas,
    threads,
    inbox: {
      items: openTasks.slice(0, 3).map(
        (task): DashboardInboxTask => ({
          id: task._id,
          text: task.text,
          when: task.when,
          createdAt: task.createdAt,
        }),
      ),
      totalOpen: openTasks.length,
    },
    recentActivity,
  };
}
