import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ActivityLogPage,
  AreaIcon,
  AreaId,
  AreaSummary,
  CommandAcknowledgement,
  Task,
  TaskId,
  Note,
  NoteAddedToThread,
  NoteId,
  NotePage,
  Thread,
  ThreadDetail,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
  ThreadNotePage,
} from "@vita-os/contracts";

import { requireRepeat } from "@vita-os/core";

/**
 * Reading the service's answers.
 *
 * A response is untrusted JSON until a decoder here has recognized it, and an
 * unrecognized shape is an `unexpected` failure rather than a value the product
 * renders. Absent optional properties stay absent: the decoders never invent a
 * null, so the distinction between "no Summary written" and "Summary is empty"
 * survives the trip.
 */

type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalSafeInteger(value: unknown): value is number | undefined {
  return value === undefined || isSafeInteger(value);
}

function isAreaIcon(value: unknown): value is AreaIcon {
  switch (value) {
    case "Compass":
    case "HeartPulse":
    case "Dumbbell":
    case "Users":
    case "Home":
    case "BriefcaseBusiness":
    case "WalletCards":
    case "BookOpen":
    case "Utensils":
    case "Car":
    case "CalendarDays":
    case "Palette":
    case "Leaf":
    case "Shield":
    case "Plane":
      return true;
    default:
      return false;
  }
}

function isThreadState(value: unknown): value is Thread["state"] {
  return value === "open" || value === "resolved";
}

function isNoteState(value: unknown): value is Note["state"] {
  return value === "open" || value === "done";
}

function isActivityLogEntryType(
  value: unknown,
): value is ActivityLogEntry["type"] {
  return (
    value === "area_move" ||
    value === "next_move_change" ||
    value === "move_completed" ||
    value === "state_change" ||
    value === "follow_up_change"
  );
}

function decodeTask(value: unknown): Task | undefined {
  if (
    !isObject(value) ||
    typeof value._id !== "string" ||
    typeof value.text !== "string" ||
    !isOptionalSafeInteger(value.date)
  ) {
    return undefined;
  }
  let repeat: Task["repeat"];
  if (Object.hasOwn(value, "repeat")) {
    if (value.date === undefined) return undefined;
    try {
      repeat = requireRepeat(value.repeat);
    } catch {
      return undefined;
    }
  }
  return {
    _id: value._id as TaskId,
    text: value.text,
    ...(value.date === undefined ? {} : { date: value.date }),
    ...(repeat === undefined ? {} : { repeat }),
  };
}

/** Every entry decodes, or the whole list is unrecognized. */
function decodeList<T>(
  value: unknown,
  decodeEntry: (entry: unknown) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const entries: T[] = [];
  for (const entry of value) {
    const decoded = decodeEntry(entry);
    if (decoded === undefined) return undefined;
    entries.push(decoded);
  }
  return entries;
}

export function decodeAreaSummary(value: unknown): AreaSummary | undefined {
  if (!isObject(value)) return undefined;

  const { _id, name, slug, icon, order, createdAt } = value;
  if (
    typeof _id !== "string" ||
    typeof name !== "string" ||
    typeof slug !== "string" ||
    !isAreaIcon(icon) ||
    !isSafeInteger(order) ||
    !isSafeInteger(createdAt)
  ) {
    return undefined;
  }

  return {
    _id: _id as AreaId,
    name,
    slug,
    icon,
    order,
    createdAt,
  };
}

export function decodeThread(value: unknown): Thread | undefined {
  if (!isObject(value)) return undefined;

  const {
    _id,
    title,
    slug,
    summary,
    areaId,
    order,
    state,
    tasks: rawTasks,
    focusedTaskId,
    lastActivityAt,
    lastActivityContent,
    createdAt,
    revision,
  } = value;
  const tasks =
    rawTasks === undefined ? undefined : decodeList(rawTasks, decodeTask);
  if (
    typeof _id !== "string" ||
    typeof title !== "string" ||
    typeof slug !== "string" ||
    !isOptionalString(summary) ||
    !isOptionalString(areaId) ||
    !isSafeInteger(order) ||
    !isThreadState(state) ||
    (rawTasks !== undefined && tasks === undefined) ||
    !isOptionalString(focusedTaskId) ||
    !isOptionalSafeInteger(lastActivityAt) ||
    !isOptionalString(lastActivityContent) ||
    !isSafeInteger(createdAt) ||
    !isSafeInteger(revision) ||
    revision < 0
  ) {
    return undefined;
  }

  return {
    _id: _id as ThreadId,
    title,
    slug,
    ...(summary === undefined ? {} : { summary }),
    ...(areaId === undefined ? {} : { areaId: areaId as AreaId }),
    order,
    state,
    ...(tasks === undefined ? {} : { tasks }),
    ...(focusedTaskId === undefined
      ? {}
      : { focusedTaskId: focusedTaskId as TaskId }),
    ...(lastActivityAt === undefined ? {} : { lastActivityAt }),
    ...(lastActivityContent === undefined ? {} : { lastActivityContent }),
    createdAt,
    revision,
  };
}

export function decodeThreadDetail(value: unknown): ThreadDetail | undefined {
  if (!isObject(value)) return undefined;

  const thread = decodeThread(value.thread);
  if (thread === undefined) return undefined;
  if (value.area === undefined) return { thread };

  const area = decodeAreaSummary(value.area);
  if (area === undefined) return undefined;

  return { thread, area };
}

export function decodeAreaList(value: unknown): AreaSummary[] | undefined {
  return decodeList(value, decodeAreaSummary);
}

export function decodeThreadList(value: unknown): Thread[] | undefined {
  return decodeList(value, decodeThread);
}

export function decodeNote(value: unknown): Note | undefined {
  if (!isObject(value)) return undefined;

  const { _id, body, followUp, state, completedAt, createdAt, updatedAt } =
    value;
  if (
    typeof _id !== "string" ||
    typeof body !== "string" ||
    !isOptionalSafeInteger(followUp) ||
    !isNoteState(state) ||
    !isOptionalSafeInteger(completedAt) ||
    !isSafeInteger(createdAt) ||
    !isOptionalSafeInteger(updatedAt)
  ) {
    return undefined;
  }

  return {
    _id: _id as NoteId,
    body,
    ...(followUp === undefined ? {} : { followUp }),
    state,
    ...(completedAt === undefined ? {} : { completedAt }),
    createdAt,
    ...(updatedAt === undefined ? {} : { updatedAt }),
  };
}

export function decodeNoteList(value: unknown): Note[] | undefined {
  return decodeList(value, decodeNote);
}

export function decodeThreadNote(value: unknown): ThreadNote | undefined {
  if (!isObject(value)) return undefined;

  const { _id, body, state, completedAt, createdAt, updatedAt } = value;
  if (
    typeof _id !== "string" ||
    typeof body !== "string" ||
    !isNoteState(state) ||
    !isOptionalSafeInteger(completedAt) ||
    !isSafeInteger(createdAt) ||
    !isSafeInteger(updatedAt)
  ) {
    return undefined;
  }

  return {
    _id: _id as ThreadNoteId,
    body,
    state,
    ...(completedAt === undefined ? {} : { completedAt }),
    createdAt,
    updatedAt,
  };
}

export function decodeThreadNoteList(value: unknown): ThreadNote[] | undefined {
  return decodeList(value, decodeThreadNote);
}

export function decodeNoteAddedToThread(
  value: unknown,
): NoteAddedToThread | undefined {
  if (!isObject(value)) return undefined;

  const thread = decodeThread(value.thread);
  const threadNote = decodeThreadNote(value.threadNote);
  if (thread === undefined || threadNote === undefined) return undefined;

  return { thread, threadNote };
}

export function decodeActivityLogEntry(
  value: unknown,
): ActivityLogEntry | undefined {
  if (!isObject(value)) return undefined;

  const { _id, type, content, previousValue, newValue, createdAt } = value;
  if (
    typeof _id !== "string" ||
    !isActivityLogEntryType(type) ||
    typeof content !== "string" ||
    !isOptionalString(previousValue) ||
    !isOptionalString(newValue) ||
    !isSafeInteger(createdAt)
  ) {
    return undefined;
  }

  return {
    _id: _id as ActivityLogEntryId,
    type,
    content,
    ...(previousValue === undefined ? {} : { previousValue }),
    ...(newValue === undefined ? {} : { newValue }),
    createdAt,
  };
}

/** One page of a history: recognized entries plus the cursor behind them. */
function decodePage<T>(
  value: unknown,
  decodeEntry: (entry: unknown) => T | undefined,
): { entries: T[]; nextCursor?: string } | undefined {
  if (!isObject(value)) return undefined;

  const entries = decodeList(value.entries, decodeEntry);
  if (entries === undefined || !isOptionalString(value.nextCursor)) {
    return undefined;
  }

  return {
    entries,
    ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }),
  };
}

export function decodeActivityLogPage(
  value: unknown,
): ActivityLogPage | undefined {
  return decodePage(value, decodeActivityLogEntry);
}

export function decodeNotePage(value: unknown): NotePage | undefined {
  return decodePage(value, decodeNote);
}

export function decodeThreadNotePage(
  value: unknown,
): ThreadNotePage | undefined {
  return decodePage(value, decodeThreadNote);
}

export function decodeAcknowledgement(
  value: unknown,
): CommandAcknowledgement | undefined {
  if (!isObject(value) || value.acknowledged !== true) return undefined;
  return { acknowledged: true };
}

export function decodeCount(value: unknown): number | undefined {
  if (!isObject(value) || !isSafeInteger(value.count)) return undefined;
  return value.count;
}
