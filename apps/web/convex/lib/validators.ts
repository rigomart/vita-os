import type { Infer } from "convex/values";

import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";

import { AREA_ICONS } from "./areaIcons";
import { CONDITIONS } from "./condition";

export const areaIconValidator = v.union(
  v.literal(AREA_ICONS[0]),
  v.literal(AREA_ICONS[1]),
  v.literal(AREA_ICONS[2]),
  v.literal(AREA_ICONS[3]),
  v.literal(AREA_ICONS[4]),
  v.literal(AREA_ICONS[5]),
  v.literal(AREA_ICONS[6]),
  v.literal(AREA_ICONS[7]),
  v.literal(AREA_ICONS[8]),
  v.literal(AREA_ICONS[9]),
  v.literal(AREA_ICONS[10]),
  v.literal(AREA_ICONS[11]),
  v.literal(AREA_ICONS[12]),
  v.literal(AREA_ICONS[13]),
  v.literal(AREA_ICONS[14]),
);

export const conditionValidator = v.union(
  v.literal(CONDITIONS[0]),
  v.literal(CONDITIONS[1]),
  v.literal(CONDITIONS[2]),
);

/**
 * Every kind of Activity Log entry the app writes — `note` by hand, the rest
 * automatically from a Thread change. Adding a member here is how a new kind
 * becomes writable; there are no variants kept "for later".
 */
export const activityLogEntryTypeValidator = v.union(
  v.literal("note"),
  v.literal("area_move"),
  v.literal("next_action_change"),
  v.literal("state_change"),
  v.literal("follow_up_change"),
);

/**
 * What a query hands back, as opposed to what a table stores. One projection
 * per table, reused by every query returning that kind of document.
 *
 * `userId` never leaves the server. And because the projection is shared,
 * the optimistic cache can copy a document between queries without the
 * destination's validator rejecting it.
 */

export const projectedAreaValidator = v.object({
  _id: v.id("areas"),
  name: v.string(),
  slug: v.string(),
  standard: v.optional(v.string()),
  condition: conditionValidator,
  icon: areaIconValidator,
  order: v.number(),
  createdAt: v.number(),
});

export type ProjectedArea = Infer<typeof projectedAreaValidator>;

export function projectArea(area: Doc<"areas">): ProjectedArea {
  return {
    _id: area._id,
    name: area.name,
    slug: area.slug,
    standard: area.standard,
    condition: area.condition,
    icon: area.icon,
    order: area.order,
    createdAt: area.createdAt,
  };
}

export const projectedThreadValidator = v.object({
  _id: v.id("threads"),
  title: v.string(),
  slug: v.string(),
  summary: v.optional(v.string()),
  areaId: v.id("areas"),
  order: v.number(),
  state: v.union(v.literal("open"), v.literal("resolved")),
  nextMove: v.optional(v.string()),
  upNext: v.optional(v.array(v.string())),
  followUp: v.optional(v.number()),
  lastActivityAt: v.optional(v.number()),
  lastActivityContent: v.optional(v.string()),
  createdAt: v.number(),
});

export type ProjectedThread = Infer<typeof projectedThreadValidator>;

export function projectThread(thread: Doc<"threads">): ProjectedThread {
  return {
    _id: thread._id,
    title: thread.title,
    slug: thread.slug,
    summary: thread.summary,
    areaId: thread.areaId,
    order: thread.order,
    state: thread.state,
    nextMove: thread.nextMove,
    upNext: thread.upNext,
    followUp: thread.followUp,
    lastActivityAt: thread.lastActivityAt,
    lastActivityContent: thread.lastActivityContent,
    createdAt: thread.createdAt,
  };
}

/**
 * Tasks keep `_creationTime`: the Inbox sorts by `createdAt` and breaks ties
 * on it, so unlike everywhere else it is a field the client genuinely reads.
 */
export const projectedTaskValidator = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  text: v.string(),
  when: v.optional(v.number()),
  state: v.union(v.literal("open"), v.literal("done")),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
});

export type ProjectedTask = Infer<typeof projectedTaskValidator>;

export function projectTask(task: Doc<"tasks">): ProjectedTask {
  return {
    _id: task._id,
    _creationTime: task._creationTime,
    text: task.text,
    when: task.when,
    state: task.state,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
  };
}

/**
 * `threadId` is dropped as well as `userId`: an entry is only ever read
 * through the Thread it belongs to, which the caller named in the arguments.
 */
export const projectedActivityLogValidator = v.object({
  _id: v.id("activityLogs"),
  type: activityLogEntryTypeValidator,
  content: v.string(),
  previousValue: v.optional(v.string()),
  newValue: v.optional(v.string()),
  createdAt: v.number(),
});

export type ProjectedActivityLog = Infer<typeof projectedActivityLogValidator>;

export function projectActivityLog(
  log: Doc<"activityLogs">,
): ProjectedActivityLog {
  return {
    _id: log._id,
    type: log.type,
    content: log.content,
    previousValue: log.previousValue,
    newValue: log.newValue,
    createdAt: log.createdAt,
  };
}
