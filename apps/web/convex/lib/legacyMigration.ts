import type { Doc, Id } from "../_generated/dataModel";
import type { ActivityLogEntryType } from "./activityLog";
import type { Condition } from "./condition";
import { toThreadLifecycleState } from "./types";

export type LegacyAreaForMigration = Doc<"areas"> & {
  condition?: Condition;
};

export type ThreadState = "open" | "resolved";
export type TaskState = "open" | "done";

export type MigratedThread = {
  userId: string;
  title: string;
  slug?: string;
  summary?: string;
  areaId: Id<"areas">;
  order: number;
  state: ThreadState;
  nextMove?: string;
  followUp?: number;
  legacyProjectId: Id<"projects">;
  createdAt: number;
};

export type MigratedTask = {
  userId: string;
  text: string;
  when?: number;
  state: TaskState;
  completedAt?: number;
  legacyItemId: Id<"items">;
  createdAt: number;
};

export type GeneratedActivityLogEntry = {
  userId: string;
  type: ActivityLogEntryType;
  content: string;
  previousValue?: string;
  newValue?: string;
  legacyProjectId: Id<"projects">;
  migrationSourceKey: string;
  createdAt: number;
};

export type MigratedActivityLogEntry = {
  userId: string;
  threadId: unknown;
  type: ActivityLogEntryType;
  content: string;
  previousValue?: string;
  newValue?: string;
  legacyProjectLogId?: Id<"projectLogs">;
  legacyProjectId?: Id<"projects">;
  migrationSourceKey?: string;
  createdAt: number;
};

type ActionQueueEntry = {
  id: string;
  text: string;
};

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getActionQueue(project: Doc<"projects">): ActionQueueEntry[] {
  return project.actionQueue ?? [];
}

function getNextMoveSource(
  project: Doc<"projects">,
):
  | { text: string; source: "nextMove" }
  | { text: string; source: "actionQueue"; index: number }
  | null {
  const nextMove = cleanText(project.nextMove);
  if (nextMove) return { text: nextMove, source: "nextMove" };

  const firstAction = cleanText(getActionQueue(project)[0]?.text);
  if (firstAction)
    return { text: firstAction, source: "actionQueue", index: 0 };

  return null;
}

function getFollowUpSource(
  project: Doc<"projects">,
):
  | { value: number; source: "followUp" }
  | { value: number; source: "waitingFollowUpDate" }
  | null {
  if (project.followUp !== undefined) {
    return { value: project.followUp, source: "followUp" };
  }
  if (project.waitingFollowUpDate !== undefined) {
    return {
      value: project.waitingFollowUpDate,
      source: "waitingFollowUpDate",
    };
  }
  return null;
}

export function buildAreaConditionPatch(
  area: LegacyAreaForMigration,
): { condition: Condition } | null {
  if (area.condition === area.healthStatus) return null;
  return { condition: area.healthStatus };
}

export function buildMigratedThread(project: Doc<"projects">): MigratedThread {
  const state = toThreadLifecycleState(project.state);
  const thread: MigratedThread = {
    userId: project.userId,
    title: project.name,
    areaId: project.areaId,
    order: project.order,
    state,
    legacyProjectId: project._id,
    createdAt: project.createdAt,
  };

  if (project.slug) thread.slug = project.slug;

  const summary = cleanText(project.definitionOfDone);
  if (summary) thread.summary = summary;

  if (state === "open") {
    const nextMove = getNextMoveSource(project);
    if (nextMove) thread.nextMove = nextMove.text;

    const followUp = getFollowUpSource(project);
    if (followUp) thread.followUp = followUp.value;
  }

  return thread;
}

export function buildMigratedTask(item: Doc<"items">): MigratedTask {
  const task: MigratedTask = {
    userId: item.userId,
    text: item.text,
    state: item.isCompleted ? "done" : "open",
    legacyItemId: item._id,
    createdAt: item.createdAt,
  };

  if (item.date !== undefined) task.when = item.date;
  if (item.completedAt !== undefined) task.completedAt = item.completedAt;

  return task;
}

export function buildMigratedActivityLogFromProjectLog(
  projectLog: Doc<"projectLogs">,
  threadId: unknown,
): MigratedActivityLogEntry {
  const entry: MigratedActivityLogEntry = {
    userId: projectLog.userId,
    threadId,
    type: projectLog.type,
    content: projectLog.content,
    legacyProjectLogId: projectLog._id,
    legacyProjectId: projectLog.projectId,
    createdAt: projectLog.createdAt,
  };

  if (projectLog.previousValue !== undefined) {
    entry.previousValue = projectLog.previousValue;
  }
  if (projectLog.newValue !== undefined) {
    entry.newValue = projectLog.newValue;
  }

  return entry;
}

export function buildGeneratedActivityLogEntries(
  project: Doc<"projects">,
): GeneratedActivityLogEntry[] {
  const entries: GeneratedActivityLogEntry[] = [];
  const state = toThreadLifecycleState(project.state);
  let offset = 0;

  const push = (
    entry: Omit<
      GeneratedActivityLogEntry,
      "userId" | "legacyProjectId" | "createdAt"
    >,
  ) => {
    entries.push({
      userId: project.userId,
      legacyProjectId: project._id,
      createdAt: project.createdAt + offset,
      ...entry,
    });
    offset += 1;
  };

  const summary = cleanText(project.definitionOfDone);
  if (summary) {
    push({
      type: "reference",
      content: `Legacy Definition of Done became Thread summary: ${summary}`,
      newValue: summary,
      migrationSourceKey: "legacy:definitionOfDone",
    });
  }

  if (project.state === "completed" || project.state === "dropped") {
    push({
      type: "state_change",
      content: `Legacy Project state "${project.state}" became Resolved`,
      previousValue: project.state,
      newValue: "resolved",
      migrationSourceKey: "legacy:state",
    });
  }

  const status = cleanText(project.status);
  if (status) {
    push({
      type: "status_change",
      content: `Legacy status preserved: ${status}`,
      newValue: status,
      migrationSourceKey: "legacy:status",
    });
  }

  const waitingParts: string[] = [];
  const waitingOn = cleanText(project.waitingOn);
  if (waitingOn) waitingParts.push(`waiting on ${waitingOn}`);
  if (project.waitingSince !== undefined) {
    waitingParts.push(`waiting since ${formatDate(project.waitingSince)}`);
  }
  if (project.waitingExpectedDate !== undefined) {
    waitingParts.push(`expected ${formatDate(project.waitingExpectedDate)}`);
  }
  if (project.waitingFollowUpDate !== undefined) {
    waitingParts.push(
      `waiting follow-up ${formatDate(project.waitingFollowUpDate)}`,
    );
  }
  if (waitingParts.length > 0) {
    push({
      type: "waiting_change",
      content: `Legacy waiting context preserved: ${waitingParts.join("; ")}`,
      newValue: waitingParts.join("; "),
      migrationSourceKey: "legacy:waiting",
    });
  }

  if (project.actionDate !== undefined) {
    push({
      type: "reference",
      content: `Legacy action date preserved: ${formatDate(project.actionDate)}`,
      newValue: formatDate(project.actionDate),
      migrationSourceKey: "legacy:actionDate",
    });
  }

  if (project.targetDate !== undefined) {
    push({
      type: "reference",
      content: `Legacy target date preserved: ${formatDate(project.targetDate)}`,
      newValue: formatDate(project.targetDate),
      migrationSourceKey: "legacy:targetDate",
    });
  }

  const nextMoveSource = getNextMoveSource(project);
  if (state === "resolved" && nextMoveSource) {
    push({
      type: "next_action_change",
      content: `Legacy Next Move preserved from resolved Thread: ${nextMoveSource.text}`,
      newValue: nextMoveSource.text,
      migrationSourceKey:
        nextMoveSource.source === "nextMove"
          ? "legacy:nextMove"
          : `legacy:actionQueue:${nextMoveSource.index}`,
    });
  }

  const followUpSource = getFollowUpSource(project);
  if (state === "resolved" && followUpSource?.source === "followUp") {
    push({
      type: "follow_up_change",
      content: `Legacy Follow-up preserved from resolved Thread: ${formatDate(
        followUpSource.value,
      )}`,
      newValue: formatDate(followUpSource.value),
      migrationSourceKey: "legacy:followUp",
    });
  }

  const usedActionQueueIndex =
    nextMoveSource?.source === "actionQueue" ? nextMoveSource.index : undefined;

  getActionQueue(project).forEach((action, index) => {
    if (index === usedActionQueueIndex) return;
    const actionText = cleanText(action.text);
    if (!actionText) return;

    push({
      type: "next_action_change",
      content: `Legacy action queue entry preserved: ${actionText}`,
      newValue: actionText,
      migrationSourceKey: `legacy:actionQueue:${index}`,
    });
  });

  return entries;
}
