import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  type AutoActivityLogEntry,
  buildAreaMoveLogEntry,
} from "./activityLog";

type MutationCtx = GenericMutationCtx<DataModel>;

type ThreadPatch = Partial<
  Pick<
    Doc<"threads">,
    "title" | "slug" | "summary" | "areaId" | "nextMove" | "followUp" | "state"
  >
>;

type AutoActivityLog = AutoActivityLogEntry;

function hasOwn(obj: object, key: PropertyKey): boolean {
  return Object.keys(obj).includes(String(key));
}

function formatFollowUpDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildFieldChangeLogEntry(options: {
  type: AutoActivityLog["type"];
  oldValue: string | undefined;
  newValue: string | undefined;
  label: string;
}): AutoActivityLog | null {
  const { type, oldValue, newValue, label } = options;
  if (oldValue === newValue) return null;

  if (oldValue && newValue) {
    return {
      type,
      content: `${label} changed from "${oldValue}" to "${newValue}"`,
      previousValue: oldValue,
      newValue,
    };
  }
  if (!oldValue && newValue) {
    return {
      type,
      content: `${label} set to "${newValue}"`,
      previousValue: undefined,
      newValue,
    };
  }
  if (oldValue && !newValue) {
    return {
      type,
      content: `${label} cleared`,
      previousValue: oldValue,
      newValue: undefined,
    };
  }
  return null;
}

export function buildThreadPatchLogEntries(
  thread: Doc<"threads">,
  patch: ThreadPatch,
  options?: {
    fromAreaName?: string;
    toAreaName?: string;
    lifecycleLog?: AutoActivityLog;
  },
): AutoActivityLog[] {
  const logs: AutoActivityLog[] = [];

  if (
    hasOwn(patch, "areaId") &&
    patch.areaId !== undefined &&
    patch.areaId !== thread.areaId &&
    options?.fromAreaName &&
    options?.toAreaName
  ) {
    logs.push(buildAreaMoveLogEntry(options.fromAreaName, options.toAreaName));
  }

  if (hasOwn(patch, "nextMove")) {
    const entry = buildFieldChangeLogEntry({
      type: "next_action_change",
      oldValue: thread.nextMove ?? undefined,
      newValue: patch.nextMove ?? undefined,
      label: "Next move",
    });
    if (entry) logs.push(entry);
  }

  if (
    hasOwn(patch, "state") &&
    patch.state !== undefined &&
    patch.state !== thread.state
  ) {
    logs.push(
      options?.lifecycleLog ?? {
        type: "state_change",
        content: `Lifecycle changed from "${thread.state}" to "${patch.state}"`,
        previousValue: thread.state,
        newValue: patch.state,
      },
    );
  }

  if (hasOwn(patch, "followUp")) {
    const oldFollowUp = thread.followUp ?? undefined;
    const newFollowUp = patch.followUp ?? undefined;

    if (oldFollowUp !== newFollowUp) {
      const entry = buildFieldChangeLogEntry({
        type: "follow_up_change",
        oldValue:
          oldFollowUp !== undefined
            ? formatFollowUpDate(oldFollowUp)
            : undefined,
        newValue:
          newFollowUp !== undefined
            ? formatFollowUpDate(newFollowUp)
            : undefined,
        label: "Follow-up",
      });
      if (entry) logs.push(entry);
    }
  }

  return logs;
}

export async function applyThreadPatch(
  ctx: MutationCtx,
  args: {
    userId: string;
    thread: Doc<"threads">;
    patch: ThreadPatch;
    resolutionNote?: string;
  },
): Promise<void> {
  let areaMoveNames: { fromAreaName: string; toAreaName: string } | undefined;
  const lifecycleChange =
    args.patch.state !== undefined
      ? buildThreadLifecyclePatch(args.thread, {
          state: args.patch.state,
          resolutionNote: args.resolutionNote,
        })
      : null;
  const patch = lifecycleChange
    ? { ...args.patch, ...lifecycleChange.patch }
    : args.patch;

  if (patch.areaId !== undefined && patch.areaId !== args.thread.areaId) {
    const fromArea = await ctx.db.get(args.thread.areaId);
    const toArea = await ctx.db.get(patch.areaId);
    if (fromArea && toArea) {
      areaMoveNames = {
        fromAreaName: fromArea.name,
        toAreaName: toArea.name,
      };
    }
  }

  await ctx.db.patch(args.thread._id, patch);

  const now = Date.now();
  const logs = buildThreadPatchLogEntries(args.thread, patch, {
    ...areaMoveNames,
    lifecycleLog: lifecycleChange?.log,
  });
  for (const log of logs) {
    await insertAutoActivityLog(ctx, {
      userId: args.userId,
      threadId: args.thread._id,
      log,
      createdAt: now,
    });
  }
}

export function buildThreadLifecyclePatch(
  thread: Doc<"threads">,
  args: { state: Doc<"threads">["state"]; resolutionNote?: string },
): { patch: ThreadPatch; log: AutoActivityLog } | null {
  if (args.state === thread.state) return null;

  if (args.state === "resolved") {
    const note = args.resolutionNote?.trim();

    return {
      patch: {
        state: "resolved",
        nextMove: undefined,
        followUp: undefined,
      },
      log: {
        type: "state_change",
        content: note ? `Resolved thread: ${note}` : "Resolved thread",
        previousValue: thread.state,
        newValue: "resolved",
      },
    };
  }

  return {
    patch: { state: "open" },
    log: {
      type: "state_change",
      content: "Reopened thread",
      previousValue: thread.state,
      newValue: "open",
    },
  };
}

export async function completeNextMove(
  ctx: MutationCtx,
  args: { userId: string; thread: Doc<"threads"> },
): Promise<void> {
  const change = buildCompleteNextMoveChange(args.thread.nextMove ?? undefined);
  if (!change) return;

  await ctx.db.patch(args.thread._id, { nextMove: undefined });
  await insertAutoActivityLog(ctx, {
    userId: args.userId,
    threadId: args.thread._id,
    log: change.log,
    createdAt: Date.now(),
  });
}

export function buildCompleteNextMoveChange(
  nextMove: string | undefined,
): { log: AutoActivityLog } | null {
  if (!nextMove) return null;

  return {
    log: {
      type: "next_action_change",
      content: `Completed "${nextMove}" — next move cleared`,
      previousValue: nextMove,
      newValue: undefined,
    },
  };
}

async function insertAutoActivityLog(
  ctx: MutationCtx,
  args: {
    userId: string;
    threadId: Id<"threads">;
    log: AutoActivityLog;
    createdAt: number;
  },
): Promise<void> {
  await ctx.db.insert("activityLogs", {
    userId: args.userId,
    threadId: args.threadId,
    type: args.log.type,
    content: args.log.content,
    previousValue: args.log.previousValue,
    newValue: args.log.newValue,
    createdAt: args.createdAt,
  });
}
