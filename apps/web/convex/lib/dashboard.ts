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

/**
 * Shape the Dashboard payload from documents the caller has already read
 * through user-scoped indexes. This is pure presentation: it does no
 * ownership filtering, because every input is already the caller's own.
 */
export function buildDashboardOverview(
  source: DashboardSource,
  currentDate = Date.now(),
  timezoneOffsetMinutes?: number,
) {
  const areas = [...source.areas]
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
    .filter((thread) => thread.state === "open")
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
    .filter((task) => task.state === "open")
    .sort((a, b) =>
      compareTasksByAttention(a, b, currentDate, timezoneOffsetMinutes),
    );

  const openThreadIds = new Set(openThreads.map((thread) => thread._id));
  const seenThreads = new Set<Id<"threads">>();
  const recentActivity: DashboardActivity[] = [];

  // One entry per distinct Open Thread, enough to fill the Dashboard's
  // full-width activity strip at two rows of three.
  const recentActivityCap = 6;

  for (const entry of [...source.activityLogs]
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
    if (recentActivity.length === recentActivityCap) break;
  }

  return {
    areas,
    threads,
    inbox: {
      // Every Open Task, in attention order: the Dashboard Overview shows a
      // preview of the first few, while the Plan canvas plans the whole set.
      items: openTasks.map(
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
