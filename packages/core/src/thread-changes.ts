import type { AreaId, ThreadState } from "@vita-os/contracts";

import {
  type AutoActivityLogEntry,
  buildAreaMoveLogEntry,
} from "./activity-log";
import { takeFrontUpNextMove } from "./up-next";

/** The stored Thread values every change rule reads. */
export interface ThreadChangeState {
  title: string;
  slug: string;
  summary?: string;
  areaId: AreaId;
  state: ThreadState;
  nextMove?: string;
  upNext?: string[];
  followUp?: number;
}

/**
 * The fields one write may change.
 *
 * Presence is meaningful and distinct from value: a key that is absent leaves
 * the stored value alone, while a key present with no value clears it. Callers
 * translate the transport's `null` into that absent value before arriving here.
 */
export type ThreadPatch = Partial<ThreadChangeState>;

const PATCHABLE_FIELDS = [
  "title",
  "slug",
  "summary",
  "areaId",
  "nextMove",
  "upNext",
  "followUp",
  "state",
] as const satisfies readonly (keyof ThreadChangeState)[];

function hasOwn(patch: object, key: PropertyKey): boolean {
  return Object.keys(patch).includes(String(key));
}

/**
 * Only the fields a Thread write may carry, presence preserved. Anything a
 * caller added — a client-side row key, a dashboard id — is dropped rather
 * than written, so a projection can be handed straight to a write.
 */
export function sanitizeThreadPatch(patch: ThreadPatch): ThreadPatch {
  const safe: ThreadPatch = {};
  for (const field of PATCHABLE_FIELDS) {
    if (hasOwn(patch, field)) {
      // Each field keeps its own type; the loop is what makes this a cast.
      (safe as Record<string, unknown>)[field] = patch[field];
    }
  }
  return safe;
}

/**
 * The Up Next invariant, folded into a patch before it is written: while the
 * line holds moves, the Next Move slot is full. A write that would empty the
 * slot — completing it, clearing it, or an edit that leaves it empty — takes
 * the front move instead, and the ordinary Next Move entry carries it.
 */
export function fillNextMoveFromUpNext(
  thread: Pick<ThreadChangeState, "nextMove" | "upNext">,
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
  type: AutoActivityLogEntry["type"];
  oldValue: string | undefined;
  newValue: string | undefined;
  label: string;
}): AutoActivityLogEntry | null {
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

/** The Activity Log a patch earns, in the order the entries are written. */
export function buildThreadPatchLogEntries(
  thread: ThreadChangeState,
  patch: ThreadPatch,
  options?: {
    fromAreaName?: string;
    toAreaName?: string;
    lifecycleLog?: AutoActivityLogEntry;
  },
): AutoActivityLogEntry[] {
  const safePatch = sanitizeThreadPatch(patch);
  const logs: AutoActivityLogEntry[] = [];

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
          oldFollowUp === undefined
            ? undefined
            : formatFollowUpDate(oldFollowUp),
        newValue:
          newFollowUp === undefined
            ? undefined
            : formatFollowUpDate(newFollowUp),
        label: "Follow-up",
      });
      if (entry) logs.push(entry);
    }
  }

  return logs;
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

/**
 * What a lifecycle change writes, or `null` when the Thread is already in the
 * requested state. Resolving clears the whole attention state; reopening
 * restores none of it.
 */
export function buildThreadLifecyclePatch(
  thread: ThreadChangeState,
  args: { state: ThreadState; resolutionNote?: string },
): { patch: ThreadPatch; log: AutoActivityLogEntry } | null {
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

export interface ThreadUpdateDecision {
  /** Exactly what storage writes to the Thread. */
  patch: ThreadPatch;
  /** The Activity Log entries the write records, in order. */
  logs: AutoActivityLogEntry[];
}

/**
 * The whole decision one Thread update makes, with no storage in sight: the
 * lifecycle rule, the Up Next promotion invariant, and every Activity Log entry
 * the change earns. Storage applies the patch and the entries together or not
 * at all.
 *
 * `areaNames` names both ends of an Area move. Without it — a caller that could
 * not read both Areas — the move still happens and only its log entry is
 * omitted, which is what the Convex implementation did.
 */
export function decideThreadUpdate(input: {
  thread: ThreadChangeState;
  patch: ThreadPatch;
  resolutionNote?: string;
  areaNames?: { from: string; to: string };
}): ThreadUpdateDecision {
  const requestedPatch = sanitizeThreadPatch(input.patch);
  const lifecycleChange =
    requestedPatch.state !== undefined
      ? buildThreadLifecyclePatch(input.thread, {
          state: requestedPatch.state,
          ...(input.resolutionNote === undefined
            ? {}
            : { resolutionNote: input.resolutionNote }),
        })
      : null;
  const patch = lifecycleChange
    ? sanitizeThreadPatch({ ...requestedPatch, ...lifecycleChange.patch })
    : requestedPatch;
  const writePatch = fillNextMoveFromUpNext(input.thread, patch);

  return {
    patch: writePatch,
    logs: buildThreadPatchLogEntries(input.thread, writePatch, {
      ...(input.areaNames === undefined
        ? {}
        : {
            fromAreaName: input.areaNames.from,
            toAreaName: input.areaNames.to,
          }),
      ...(lifecycleChange === null
        ? {}
        : { lifecycleLog: lifecycleChange.log }),
    }),
  };
}
