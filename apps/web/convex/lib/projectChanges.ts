import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

type MutationCtx = GenericMutationCtx<DataModel>;

export type ActionQueueItem = { id: string; text: string };

type ProjectPatch = Partial<
  Pick<
    Doc<"projects">,
    | "name"
    | "slug"
    | "definitionOfDone"
    | "areaId"
    | "status"
    | "actionQueue"
    | "state"
    | "actionDate"
    | "targetDate"
    | "waitingOn"
    | "waitingSince"
    | "waitingExpectedDate"
    | "waitingFollowUpDate"
  >
>;

type AutoProjectLog = {
  type:
    | "status_change"
    | "next_action_change"
    | "state_change"
    | "waiting_change";
  content: string;
  previousValue?: string;
  newValue?: string;
};

function hasOwn(obj: object, key: PropertyKey): boolean {
  return Object.keys(obj).includes(String(key));
}

export function buildProjectPatchLogEntries(
  project: Doc<"projects">,
  patch: ProjectPatch,
): AutoProjectLog[] {
  const logs: AutoProjectLog[] = [];

  if (
    hasOwn(patch, "status") &&
    (patch.status ?? undefined) !== (project.status ?? undefined)
  ) {
    const prev = project.status ?? "";
    const next = patch.status ?? "";
    logs.push({
      type: "status_change",
      content: prev
        ? `Status changed from "${prev}" to "${next || "(cleared)"}"`
        : `Status set to "${next}"`,
      previousValue: prev || undefined,
      newValue: next || undefined,
    });
  }

  if (hasOwn(patch, "actionQueue")) {
    const oldQueue = project.actionQueue ?? [];
    const newQueue = patch.actionQueue ?? [];
    const oldFirst = oldQueue[0]?.text ?? "";
    const newFirst = newQueue[0]?.text ?? "";

    if (oldFirst !== newFirst) {
      logs.push({
        type: "next_action_change",
        content: oldFirst
          ? `Next action changed from "${oldFirst}" to "${newFirst || "(cleared)"}"`
          : `Next action set to "${newFirst}"`,
        previousValue: oldFirst || undefined,
        newValue: newFirst || undefined,
      });
    }
  }

  if (
    hasOwn(patch, "state") &&
    patch.state !== undefined &&
    patch.state !== project.state
  ) {
    logs.push({
      type: "state_change",
      content: `State changed from "${project.state}" to "${patch.state}"`,
      previousValue: project.state,
      newValue: patch.state,
    });
  }

  return logs;
}

export function buildCompleteNextActionChange(queue: ActionQueueItem[]): {
  remaining: ActionQueueItem[];
  log: AutoProjectLog;
} | null {
  if (queue.length === 0) return null;

  const completed = queue[0];
  const remaining = queue.slice(1);
  const next = remaining[0]?.text ?? "";

  return {
    remaining,
    log: {
      type: "next_action_change",
      content: next
        ? `Completed "${completed.text}" — next action is now "${next}"`
        : `Completed "${completed.text}" — no more actions queued`,
      previousValue: completed.text,
      newValue: next || undefined,
    },
  };
}

export function buildPrependNextActionChange(
  queue: ActionQueueItem[],
  text: string,
  id: string,
): {
  actionQueue: ActionQueueItem[];
  log: AutoProjectLog;
} {
  const prev = queue[0]?.text ?? "";
  return {
    actionQueue: [{ id, text }, ...queue],
    log: {
      type: "next_action_change",
      content: prev
        ? `Next action changed from "${prev}" to "${text}"`
        : `Next action set to "${text}"`,
      previousValue: prev || undefined,
      newValue: text,
    },
  };
}

export async function applyProjectPatch(
  ctx: MutationCtx,
  args: {
    userId: string;
    project: Doc<"projects">;
    patch: ProjectPatch;
  },
): Promise<void> {
  await ctx.db.patch(args.project._id, args.patch);

  const now = Date.now();
  const logs = buildProjectPatchLogEntries(args.project, args.patch);
  for (const log of logs) {
    await insertAutoProjectLog(ctx, {
      userId: args.userId,
      projectId: args.project._id,
      log,
      createdAt: now,
    });
  }
}

export async function completeNextAction(
  ctx: MutationCtx,
  args: { userId: string; project: Doc<"projects"> },
): Promise<void> {
  const change = buildCompleteNextActionChange(args.project.actionQueue ?? []);
  if (!change) return;

  await ctx.db.patch(args.project._id, { actionQueue: change.remaining });
  await insertAutoProjectLog(ctx, {
    userId: args.userId,
    projectId: args.project._id,
    log: change.log,
    createdAt: Date.now(),
  });
}

export async function prependNextAction(
  ctx: MutationCtx,
  args: { userId: string; project: Doc<"projects">; text: string },
): Promise<ActionQueueItem> {
  const item = { id: crypto.randomUUID(), text: args.text };
  const change = buildPrependNextActionChange(
    args.project.actionQueue ?? [],
    args.text,
    item.id,
  );

  await ctx.db.patch(args.project._id, { actionQueue: change.actionQueue });
  await insertAutoProjectLog(ctx, {
    userId: args.userId,
    projectId: args.project._id,
    log: change.log,
    createdAt: Date.now(),
  });

  return item;
}

async function insertAutoProjectLog(
  ctx: MutationCtx,
  args: {
    userId: string;
    projectId: Id<"projects">;
    log: AutoProjectLog;
    createdAt: number;
  },
): Promise<void> {
  await ctx.db.insert("projectLogs", {
    userId: args.userId,
    projectId: args.projectId,
    type: args.log.type,
    content: args.log.content,
    previousValue: args.log.previousValue,
    newValue: args.log.newValue,
    createdAt: args.createdAt,
  });
}
