import type { GenericMutationCtx } from "convex/server";

import type { DataModel, Doc } from "../_generated/dataModel";

import {
  type AutoActivityLogEntry,
  buildAreaMoveLogEntry,
} from "./activityLog";
import { recordActivity } from "./activityWrites";
import { getOwned } from "./ownedAccess";
import { takeFrontUpNextMove } from "./upNext";

type MutationCtx = GenericMutationCtx<DataModel>;

type ThreadPatch = Partial<
  Pick<
    Doc<"threads">,
    | "title"
    | "slug"
    | "summary"
    | "areaId"
    | "nextMove"
    | "upNext"
    | "followUp"
    | "state"
  >
>;

type AutoActivityLog = AutoActivityLogEntry;

function hasOwn(obj: object, key: PropertyKey): boolean {
  return Object.keys(obj).includes(String(key));
}

export function sanitizeThreadPatch(patch: ThreadPatch): ThreadPatch {
  return {
    ...(hasOwn(patch, "title") ? { title: patch.title } : {}),
    ...(hasOwn(patch, "slug") ? { slug: patch.slug } : {}),
    ...(hasOwn(patch, "summary") ? { summary: patch.summary } : {}),
    ...(hasOwn(patch, "areaId") ? { areaId: patch.areaId } : {}),
    ...(hasOwn(patch, "nextMove") ? { nextMove: patch.nextMove } : {}),
    ...(hasOwn(patch, "upNext") ? { upNext: patch.upNext } : {}),
    ...(hasOwn(patch, "followUp") ? { followUp: patch.followUp } : {}),
    ...(hasOwn(patch, "state") ? { state: patch.state } : {}),
  };
}

/**
 * The Up Next invariant, folded into a patch before it is written: while the
 * line holds moves, the Next Move slot is full. A write that would empty the
 * slot — completing it, clearing it, or an edit that leaves it empty — takes
 * the front move instead, and the ordinary Next Move entry carries it.
 */
function fillNextMoveFromUpNext(
  thread: Doc<"threads">,
  patch: ThreadPatch,
): ThreadPatch {
  const nextMove = hasOwn(patch, "nextMove") ? patch.nextMove : thread.nextMove;
  if (nextMove) return patch;

  const upNext = hasOwn(patch, "upNext") ? patch.upNext : thread.upNext;
  const promotion = takeFrontUpNextMove(upNext);
  if (!promotion) return patch;

  return { ...patch, nextMove: promotion.nextMove, upNext: promotion.upNext };
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
  const safePatch = sanitizeThreadPatch(patch);
  const logs: AutoActivityLog[] = [];

  if (
    hasOwn(safePatch, "areaId") &&
    safePatch.areaId !== undefined &&
    safePatch.areaId !== thread.areaId &&
    options?.fromAreaName &&
    options?.toAreaName
  ) {
    logs.push(buildAreaMoveLogEntry(options.fromAreaName, options.toAreaName));
  }

  if (hasOwn(safePatch, "nextMove")) {
    const entry = buildFieldChangeLogEntry({
      type: "next_action_change",
      oldValue: thread.nextMove ?? undefined,
      newValue: safePatch.nextMove ?? undefined,
      label: "Next move",
    });
    if (entry) logs.push(entry);
  }

  if (
    hasOwn(safePatch, "state") &&
    safePatch.state !== undefined &&
    safePatch.state !== thread.state
  ) {
    logs.push(
      options?.lifecycleLog ?? {
        type: "state_change",
        content: `Lifecycle changed from "${thread.state}" to "${safePatch.state}"`,
        previousValue: thread.state,
        newValue: safePatch.state,
      },
    );
  }

  if (hasOwn(safePatch, "followUp")) {
    const oldFollowUp = thread.followUp ?? undefined;
    const newFollowUp = safePatch.followUp ?? undefined;

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
  const requestedPatch = sanitizeThreadPatch(args.patch);
  let areaMoveNames: { fromAreaName: string; toAreaName: string } | undefined;
  const lifecycleChange =
    requestedPatch.state !== undefined
      ? buildThreadLifecyclePatch(args.thread, {
          state: requestedPatch.state,
          resolutionNote: args.resolutionNote,
        })
      : null;
  const patch = lifecycleChange
    ? sanitizeThreadPatch({ ...requestedPatch, ...lifecycleChange.patch })
    : requestedPatch;
  const writePatch = fillNextMoveFromUpNext(args.thread, patch);

  if (
    writePatch.areaId !== undefined &&
    writePatch.areaId !== args.thread.areaId
  ) {
    const fromArea = await getOwned(ctx, "areas", {
      userId: args.userId,
      id: args.thread.areaId,
    });
    const toArea = await getOwned(ctx, "areas", {
      userId: args.userId,
      id: writePatch.areaId,
    });
    if (fromArea && toArea) {
      areaMoveNames = {
        fromAreaName: fromArea.name,
        toAreaName: toArea.name,
      };
    }
  }

  await ctx.db.patch(args.thread._id, writePatch);

  const now = Date.now();
  const logs = buildThreadPatchLogEntries(args.thread, writePatch, {
    ...areaMoveNames,
    lifecycleLog: lifecycleChange?.log,
  });
  for (const log of logs) {
    await recordActivity(ctx, {
      userId: args.userId,
      threadId: args.thread._id,
      entry: log,
      createdAt: now,
    });
  }
}

/**
 * Resolving takes the Thread's Up Next line with it, so the entry that records
 * the resolution names the moves being dropped — otherwise they would vanish
 * with nothing in the Activity Log to show for them.
 */
function buildResolutionContent(
  note: string | undefined,
  discardedUpNext: readonly string[],
): string {
  const resolution = note ? `Resolved thread: ${note}` : "Resolved thread";
  if (discardedUpNext.length === 0) return resolution;

  const moves = discardedUpNext.map((move) => `"${move}"`).join(", ");
  return `${resolution} — discarded upcoming moves: ${moves}`;
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
        upNext: undefined,
        followUp: undefined,
      },
      log: {
        type: "state_change",
        content: buildResolutionContent(note, thread.upNext ?? []),
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

/**
 * Complete the Next Move, and — when Up Next holds moves — hand the slot
 * straight to the front one. The promotion rides the completion entry rather
 * than adding an entry of its own, so a run down a planned Thread reads as one
 * line of completions.
 */
export async function completeNextMove(
  ctx: MutationCtx,
  args: { userId: string; thread: Doc<"threads"> },
): Promise<void> {
  const promotion = takeFrontUpNextMove(args.thread.upNext);
  const change = buildCompleteNextMoveChange(
    args.thread.nextMove ?? undefined,
    promotion?.nextMove,
  );
  if (!change) return;

  await ctx.db.patch(
    args.thread._id,
    promotion
      ? { nextMove: promotion.nextMove, upNext: promotion.upNext }
      : { nextMove: undefined },
  );
  await recordActivity(ctx, {
    userId: args.userId,
    threadId: args.thread._id,
    entry: change.log,
    createdAt: Date.now(),
  });
}

export function buildCompleteNextMoveChange(
  nextMove: string | undefined,
  promotedUpNextMove?: string,
): { log: AutoActivityLog } | null {
  if (!nextMove) return null;

  return {
    log: {
      type: "next_action_change",
      content: promotedUpNextMove
        ? `Completed "${nextMove}" — next move set to "${promotedUpNextMove}"`
        : `Completed "${nextMove}" — next move cleared`,
      previousValue: nextMove,
      newValue: promotedUpNextMove,
    },
  };
}
