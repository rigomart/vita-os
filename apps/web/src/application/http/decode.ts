import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  ActivityLogPage,
  AreaDetail,
  AreaIcon,
  AreaId,
  AreaSummary,
  CommandAcknowledgement,
  CompleteNextMoveOutput,
  Condition,
  Note,
  NoteId,
  NotePage,
  Thread,
  ThreadDetail,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
  ThreadNotePage,
  VersionedThread,
} from "@vita-os/contracts";

/**
 * Reading the service's answers.
 *
 * A response is untrusted JSON until a decoder here has recognized it, and an
 * unrecognized shape is an `unexpected` failure rather than a value the product
 * renders. Absent optional properties stay absent: the decoders never invent a
 * null, so the distinction between "no Standard written" and "Standard is empty"
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

function isCondition(value: unknown): value is Condition {
  return (
    value === "healthy" || value === "needs_attention" || value === "critical"
  );
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
    value === "next_action_change" ||
    value === "state_change" ||
    value === "follow_up_change"
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
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

  const { _id, name, slug, standard, condition, icon, order, createdAt } =
    value;
  if (
    typeof _id !== "string" ||
    typeof name !== "string" ||
    typeof slug !== "string" ||
    !isOptionalString(standard) ||
    !isCondition(condition) ||
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
    ...(standard === undefined ? {} : { standard }),
    condition,
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
    nextMove,
    upNext,
    followUp,
    lastActivityAt,
    lastActivityContent,
    createdAt,
  } = value;
  if (
    typeof _id !== "string" ||
    typeof title !== "string" ||
    typeof slug !== "string" ||
    !isOptionalString(summary) ||
    typeof areaId !== "string" ||
    !isSafeInteger(order) ||
    !isThreadState(state) ||
    !isOptionalString(nextMove) ||
    (upNext !== undefined && !isStringArray(upNext)) ||
    !isOptionalSafeInteger(followUp) ||
    !isOptionalSafeInteger(lastActivityAt) ||
    !isOptionalString(lastActivityContent) ||
    !isSafeInteger(createdAt)
  ) {
    return undefined;
  }

  return {
    _id: _id as ThreadId,
    title,
    slug,
    ...(summary === undefined ? {} : { summary }),
    areaId: areaId as AreaId,
    order,
    state,
    ...(nextMove === undefined ? {} : { nextMove }),
    ...(upNext === undefined ? {} : { upNext }),
    ...(followUp === undefined ? {} : { followUp }),
    ...(lastActivityAt === undefined ? {} : { lastActivityAt }),
    ...(lastActivityContent === undefined ? {} : { lastActivityContent }),
    createdAt,
  };
}

export function decodeVersionedThread(
  value: unknown,
): VersionedThread | undefined {
  const thread = decodeThread(value);
  if (thread === undefined || !isObject(value)) return undefined;

  const { revision } = value;
  if (!isSafeInteger(revision) || revision < 0) return undefined;

  return { ...thread, revision };
}

export function decodeThreadDetail(value: unknown): ThreadDetail | undefined {
  if (!isObject(value)) return undefined;

  const thread = decodeVersionedThread(value.thread);
  const area = decodeAreaSummary(value.area);
  if (thread === undefined || area === undefined) return undefined;

  return { thread, area };
}

export function decodeAreaDetail(value: unknown): AreaDetail | undefined {
  if (!isObject(value)) return undefined;

  const area = decodeAreaSummary(value.area);
  const threads = decodeList(value.threads, decodeThread);
  if (area === undefined || threads === undefined) return undefined;

  return { area, threads };
}

export function decodeAreaList(value: unknown): AreaSummary[] | undefined {
  return decodeList(value, decodeAreaSummary);
}

export function decodeThreadList(value: unknown): Thread[] | undefined {
  return decodeList(value, decodeThread);
}

export function decodeNote(value: unknown): Note | undefined {
  if (!isObject(value)) return undefined;

  const { _id, body, when, state, completedAt, createdAt, updatedAt } = value;
  if (
    typeof _id !== "string" ||
    typeof body !== "string" ||
    !isOptionalSafeInteger(when) ||
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
    ...(when === undefined ? {} : { when }),
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

export function decodeCompletion(
  value: unknown,
): CompleteNextMoveOutput | undefined {
  if (!isObject(value)) return undefined;
  if (value.status === "completed") return { status: "completed" };
  if (value.status === "unchanged") return { status: "unchanged" };
  return undefined;
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
