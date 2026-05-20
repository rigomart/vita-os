import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  type AutoActivityLogEntry,
  buildAreaMoveLogEntry,
} from "./activityLog";
import { toThreadLifecycleState } from "./types";

type MutationCtx = GenericMutationCtx<DataModel>;

type ProjectPatch = Partial<
  Pick<
    Doc<"projects">,
    | "name"
    | "slug"
    | "definitionOfDone"
    | "areaId"
    | "status"
    | "nextMove"
    | "followUp"
    | "state"
    | "actionDate"
    | "targetDate"
    | "waitingOn"
    | "waitingSince"
    | "waitingExpectedDate"
    | "waitingFollowUpDate"
  >
>;

type AutoProjectLog = AutoActivityLogEntry;

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
  type: AutoProjectLog["type"];
  oldValue: string | undefined;
  newValue: string | undefined;
  label: string;
}): AutoProjectLog | null {
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

export function buildProjectPatchLogEntries(
  project: Doc<"projects">,
  patch: ProjectPatch,
  options?: {
    fromAreaName?: string;
    toAreaName?: string;
    lifecycleLog?: AutoProjectLog;
  },
): AutoProjectLog[] {
  const logs: AutoProjectLog[] = [];

  if (
    hasOwn(patch, "areaId") &&
    patch.areaId !== undefined &&
    patch.areaId !== project.areaId &&
    options?.fromAreaName &&
    options?.toAreaName
  ) {
    logs.push(buildAreaMoveLogEntry(options.fromAreaName, options.toAreaName));
  }

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

  if (hasOwn(patch, "nextMove")) {
    const entry = buildFieldChangeLogEntry({
      type: "next_action_change",
      oldValue: project.nextMove ?? undefined,
      newValue: patch.nextMove ?? undefined,
      label: "Next move",
    });
    if (entry) logs.push(entry);
  }

  if (
    hasOwn(patch, "state") &&
    patch.state !== undefined &&
    patch.state !== project.state
  ) {
    logs.push(
      options?.lifecycleLog ?? {
        type: "state_change",
        content: `Lifecycle changed from "${project.state}" to "${patch.state}"`,
        previousValue: project.state,
        newValue: patch.state,
      },
    );
  }

  if (hasOwn(patch, "followUp")) {
    const oldFollowUp = project.followUp ?? undefined;
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

export async function applyProjectPatch(
  ctx: MutationCtx,
  args: {
    userId: string;
    project: Doc<"projects">;
    patch: ProjectPatch;
    resolutionNote?: string;
  },
): Promise<void> {
  let areaMoveNames: { fromAreaName: string; toAreaName: string } | undefined;
  const lifecycleChange =
    args.patch.state !== undefined
      ? buildThreadLifecyclePatch(args.project, {
          state: args.patch.state,
          resolutionNote: args.resolutionNote,
        })
      : null;
  const patch = lifecycleChange
    ? { ...args.patch, ...lifecycleChange.patch }
    : args.patch;

  if (patch.areaId !== undefined && patch.areaId !== args.project.areaId) {
    const fromArea = await ctx.db.get(args.project.areaId);
    const toArea = await ctx.db.get(patch.areaId);
    if (fromArea && toArea) {
      areaMoveNames = {
        fromAreaName: fromArea.name,
        toAreaName: toArea.name,
      };
    }
  }

  await ctx.db.patch(args.project._id, patch);

  const now = Date.now();
  const logs = buildProjectPatchLogEntries(args.project, patch, {
    ...areaMoveNames,
    lifecycleLog: lifecycleChange?.log,
  });
  for (const log of logs) {
    await insertAutoProjectLog(ctx, {
      userId: args.userId,
      projectId: args.project._id,
      log,
      createdAt: now,
    });
  }
}

export function buildThreadLifecyclePatch(
  project: Doc<"projects">,
  args: { state: Doc<"projects">["state"]; resolutionNote?: string },
): { patch: ProjectPatch; log: AutoProjectLog } | null {
  if (args.state === project.state) return null;

  if (args.state === "resolved") {
    const note = args.resolutionNote?.trim();
    const previousValue = toThreadLifecycleState(project.state);

    return {
      patch: {
        state: "resolved",
        nextMove: undefined,
        followUp: undefined,
      },
      log: {
        type: "state_change",
        content: note ? `Resolved thread: ${note}` : "Resolved thread",
        previousValue,
        newValue: "resolved",
      },
    };
  }

  const previousValue = toThreadLifecycleState(project.state);

  return {
    patch: { state: "open" },
    log: {
      type: "state_change",
      content: "Reopened thread",
      previousValue,
      newValue: "open",
    },
  };
}

export async function completeNextMove(
  ctx: MutationCtx,
  args: { userId: string; project: Doc<"projects"> },
): Promise<void> {
  const change = buildCompleteNextMoveChange(
    args.project.nextMove ?? undefined,
  );
  if (!change) return;

  await ctx.db.patch(args.project._id, { nextMove: undefined });
  await insertAutoProjectLog(ctx, {
    userId: args.userId,
    projectId: args.project._id,
    log: change.log,
    createdAt: Date.now(),
  });
}

export function buildCompleteNextMoveChange(
  nextMove: string | undefined,
): { log: AutoProjectLog } | null {
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
