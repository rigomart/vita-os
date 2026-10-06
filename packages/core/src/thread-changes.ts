import type { AreaId, Task, TaskId, ThreadState } from "@vita-os/contracts";

import {
  type AutoActivityLogEntry,
  buildAreaMoveLogEntry,
} from "./activity-log";
import { ConflictError } from "./errors";
import { isTaskDate } from "./tasks";

/** The stored Thread values every change rule reads. */
export interface ThreadChangeState {
  title: string;
  slug: string;
  summary?: string;
  areaId?: AreaId;
  state: ThreadState;
  tasks?: Task[];
  focusedTaskId?: TaskId;
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
  "tasks",
  "focusedTaskId",
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

  return logs;
}

/**
 * Resolving takes the Thread's Tasks with it, so the entry that records the
 * resolution names the Tasks being dropped, in capture order — otherwise they
 * would vanish with nothing in the Activity Log to show for them.
 */
function buildResolutionContent(
  note: string | undefined,
  discardedTasks: readonly Task[],
): string {
  const resolution = note ? `Resolved thread: ${note}` : "Resolved thread";
  if (discardedTasks.length === 0) return resolution;

  const tasks = discardedTasks.map((task) => `"${task.text}"`).join(", ");
  return `${resolution} — discarded tasks: ${tasks}`;
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
        tasks: undefined,
        focusedTaskId: undefined,
      },
      log: {
        type: "state_change",
        content: buildResolutionContent(note, thread.tasks ?? []),
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
 * A Task's text from a Note's body: its first non-blank line, with the leading
 * Markdown markers (`#`, `-`, `*`, `>`, a numbered-list prefix) taken off. A
 * line that is nothing but markers falls back to "Follow up".
 */
export function taskTextFromNote(body: string): string {
  const line = body.split(/\r?\n/).find((candidate) => candidate.trim() !== "");
  let text = line?.trim() ?? "";
  for (;;) {
    const stripped = text.replace(MARKDOWN_MARKER, "").trim();
    if (stripped === text) break;
    text = stripped;
  }
  return text === "" ? FOLLOW_UP_TASK_TEXT : text;
}

/** A heading, bullet or numbered item needs a space after it; a quote does not. */
const MARKDOWN_MARKER = /^(?:>|(?:#{1,6}|[-*]|\d+[.)])(?:\s+|$))/;

/** The name of the Task a date is given when nothing else can name it. */
export const FOLLOW_UP_TASK_TEXT = "Follow up";

/**
 * The Task a Note becomes when it joins a Thread, or `undefined` for an undated
 * Note. A Note date outside the range a Task date may take (it was stored
 * before the range existed) gives an undated Task, and the Note is unchanged.
 */
export function taskFromNote(
  note: { body: string; followUp?: number },
  taskId: TaskId,
): Task | undefined {
  if (note.followUp === undefined) return undefined;
  return {
    _id: taskId,
    text: taskTextFromNote(note.body),
    ...(isTaskDate(note.followUp) ? { date: note.followUp } : {}),
  };
}

/**
 * What adding a Standalone Note to a Thread does to the Thread's Tasks. A dated
 * Note adds a Task named by its first line and carrying its date, time of day
 * included and even when that date has already passed, appended to the end
 * unfocused; the whole Note joins the Thread's Notes as well, so nothing is
 * dropped. An undated Note adds no Task. Neither writes an Activity Log entry.
 * `taskId` names the Task that may be added.
 */
export function decideAddNoteToThread(
  thread: ThreadChangeState,
  note: { body: string; followUp?: number },
  taskId: TaskId,
): ThreadUpdateDecision {
  const task = taskFromNote(note, taskId);
  if (task === undefined) return { patch: {}, logs: [] };
  if (thread.tasks?.some((existing) => existing._id === taskId)) {
    throw new ConflictError("The Thread already holds that Task");
  }
  return { patch: { tasks: [...(thread.tasks ?? []), task] }, logs: [] };
}
