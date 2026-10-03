import type { AreaId, Move, MoveId, ThreadState } from "@vita-os/contracts";

import {
  type AutoActivityLogEntry,
  buildAreaMoveLogEntry,
} from "./activity-log";

/** The stored Thread values every change rule reads. */
export interface ThreadChangeState {
  title: string;
  slug: string;
  summary?: string;
  areaId?: AreaId;
  state: ThreadState;
  moves?: Move[];
  focusedMoveId?: MoveId;
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
  "moves",
  "focusedMoveId",
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
 * A Follow-up change keeps the raw timestamps rather than a written date: the
 * API that records the entry has no idea of the user's time zone, so the date
 * — and the time, when the Follow-up has one — is written where the Activity
 * Log is read.
 */
function buildFollowUpLogEntry(
  oldFollowUp: number | undefined,
  newFollowUp: number | undefined,
): AutoActivityLogEntry | null {
  if (oldFollowUp === newFollowUp) return null;

  return {
    type: "follow_up_change",
    content:
      newFollowUp === undefined
        ? "Follow-up cleared"
        : oldFollowUp === undefined
          ? "Follow-up set"
          : "Follow-up changed",
    previousValue: oldFollowUp === undefined ? undefined : String(oldFollowUp),
    newValue: newFollowUp === undefined ? undefined : String(newFollowUp),
  };
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

  if (hasOwn(safePatch, "areaId") && safePatch.areaId !== thread.areaId) {
    const fromNamed = thread.areaId === undefined || !!options?.fromAreaName;
    const toNamed = safePatch.areaId === undefined || !!options?.toAreaName;
    const entry =
      fromNamed && toNamed
        ? buildAreaMoveLogEntry(
            thread.areaId === undefined ? undefined : options?.fromAreaName,
            safePatch.areaId === undefined ? undefined : options?.toAreaName,
          )
        : null;
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
    const entry = buildFollowUpLogEntry(
      thread.followUp ?? undefined,
      safePatch.followUp ?? undefined,
    );
    if (entry) logs.push(entry);
  }

  return logs;
}

/**
 * Resolving takes the Thread's Moves with it, so the entry that records the
 * resolution names the Moves being dropped, in capture order — otherwise they
 * would vanish with nothing in the Activity Log to show for them.
 */
function buildResolutionContent(
  note: string | undefined,
  discardedMoves: readonly Move[],
): string {
  const resolution = note ? `Resolved thread: ${note}` : "Resolved thread";
  if (discardedMoves.length === 0) return resolution;

  const moves = discardedMoves.map((move) => `"${move.text}"`).join(", ");
  return `${resolution} — discarded moves: ${moves}`;
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
        moves: undefined,
        focusedMoveId: undefined,
        followUp: undefined,
      },
      log: {
        type: "state_change",
        content: buildResolutionContent(note, thread.moves ?? []),
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
 * lifecycle rule and every Activity Log entry the change earns. Storage applies the patch and the entries together or not
 * at all.
 *
 * `areaNames` names the ends of an Area change that hold an Area: `from` when
 * the Thread had one, `to` when the patch sets one. A labeled end left unnamed
 * — a caller that could not read that Area — still changes the label and only
 * omits its log entry.
 */
export function decideThreadUpdate(input: {
  thread: ThreadChangeState;
  patch: ThreadPatch;
  resolutionNote?: string;
  areaNames?: { from?: string; to?: string };
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
  return {
    patch,
    logs: buildThreadPatchLogEntries(input.thread, patch, {
      ...(input.areaNames === undefined
        ? {}
        : {
            ...(input.areaNames.from === undefined
              ? {}
              : { fromAreaName: input.areaNames.from }),
            ...(input.areaNames.to === undefined
              ? {}
              : { toAreaName: input.areaNames.to }),
          }),
      ...(lifecycleChange === null
        ? {}
        : { lifecycleLog: lifecycleChange.log }),
    }),
  };
}

/**
 * What adding a Standalone Note to a Thread does to the Thread's Follow-up
 * date: the earlier date wins. A Note dated before the Thread's date, or a
 * dated Note on an undated Thread, brings the Thread back at the Note's date —
 * time of day included, and even when that date has already passed — and earns
 * the same entry as any Follow-up change. Otherwise the Note's date is dropped
 * and the Thread's date is left alone, so nothing comes back later than the
 * person asked for.
 */
export function decideAddNoteToThread(
  thread: ThreadChangeState,
  note: { followUp?: number },
): ThreadUpdateDecision {
  const earlier =
    note.followUp !== undefined &&
    (thread.followUp === undefined || note.followUp < thread.followUp);
  const patch: ThreadPatch = earlier ? { followUp: note.followUp } : {};
  return { patch, logs: buildThreadPatchLogEntries(thread, patch) };
}
