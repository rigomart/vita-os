import type {
  AreaId,
  AreaIcon,
  Condition,
  NoteState,
  ThreadState,
} from "@vita-os/contracts";

import { isAreaIcon, isCondition } from "@vita-os/core";

/**
 * What the Worker accepts.
 *
 * A request body is untrusted text until one of these decoders has read it. Each
 * returns `undefined` for anything it does not recognize, so a handler cannot
 * accidentally act on a half-understood body. Clearing an optional value is
 * spelled `null`, which is the only thing JSON can carry for it.
 */

export type Decoded<T> = T | undefined;

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isClearableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** A revision counts changes, so any nonnegative whole number will do. */
function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isClearableTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value);
}

function isThreadState(value: unknown): value is ThreadState {
  return value === "open" || value === "resolved";
}

function isNoteState(value: unknown): value is NoteState {
  return value === "open" || value === "done";
}

/** Only the keys a decoder understands may appear. */
function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export interface CreateAreaBody {
  name: string;
  standard?: string;
  condition: Condition;
  icon: AreaIcon;
}

export function decodeCreateArea(value: unknown): Decoded<CreateAreaBody> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["name", "standard", "condition", "icon"]) ||
    typeof value.name !== "string" ||
    !isCondition(value.condition) ||
    !isAreaIcon(value.icon) ||
    (value.standard !== undefined && typeof value.standard !== "string")
  ) {
    return undefined;
  }

  return {
    name: value.name,
    ...(value.standard === undefined ? {} : { standard: value.standard }),
    condition: value.condition,
    icon: value.icon,
  };
}

export interface UpdateAreaBody {
  name?: string;
  standard?: string | null;
  condition?: Condition;
  icon?: AreaIcon;
}

export function decodeUpdateArea(value: unknown): Decoded<UpdateAreaBody> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["name", "standard", "condition", "icon"]) ||
    (value.name !== undefined && typeof value.name !== "string") ||
    (Object.hasOwn(value, "standard") && !isClearableString(value.standard)) ||
    (value.condition !== undefined && !isCondition(value.condition)) ||
    (value.icon !== undefined && !isAreaIcon(value.icon))
  ) {
    return undefined;
  }

  return {
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(Object.hasOwn(value, "standard")
      ? { standard: value.standard as string | null }
      : {}),
    ...(value.condition === undefined ? {} : { condition: value.condition }),
    ...(value.icon === undefined ? {} : { icon: value.icon }),
  };
}

export interface CreateThreadBody {
  title: string;
  summary?: string;
  areaId: AreaId;
}

export function decodeCreateThread(value: unknown): Decoded<CreateThreadBody> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["title", "summary", "areaId"]) ||
    typeof value.title !== "string" ||
    !isNonEmptyString(value.areaId) ||
    (value.summary !== undefined && typeof value.summary !== "string")
  ) {
    return undefined;
  }

  return {
    title: value.title,
    ...(value.summary === undefined ? {} : { summary: value.summary }),
    areaId: value.areaId as AreaId,
  };
}

export interface UpdateThreadBody {
  title?: string;
  summary?: string | null;
  areaId?: AreaId;
  nextMove?: string | null;
  followUp?: number | null;
  state?: ThreadState;
  resolutionNote?: string;
}

const UPDATE_THREAD_KEYS = [
  "title",
  "summary",
  "areaId",
  "nextMove",
  "followUp",
  "state",
  "resolutionNote",
] as const;

export function decodeUpdateThread(value: unknown): Decoded<UpdateThreadBody> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, UPDATE_THREAD_KEYS) ||
    (value.title !== undefined && typeof value.title !== "string") ||
    (Object.hasOwn(value, "summary") && !isClearableString(value.summary)) ||
    (value.areaId !== undefined && !isNonEmptyString(value.areaId)) ||
    (Object.hasOwn(value, "nextMove") && !isClearableString(value.nextMove)) ||
    (Object.hasOwn(value, "followUp") &&
      !isClearableTimestamp(value.followUp)) ||
    (value.state !== undefined && !isThreadState(value.state)) ||
    (value.resolutionNote !== undefined &&
      typeof value.resolutionNote !== "string")
  ) {
    return undefined;
  }

  return {
    ...(value.title === undefined ? {} : { title: value.title }),
    ...(Object.hasOwn(value, "summary")
      ? { summary: value.summary as string | null }
      : {}),
    ...(value.areaId === undefined ? {} : { areaId: value.areaId as AreaId }),
    ...(Object.hasOwn(value, "nextMove")
      ? { nextMove: value.nextMove as string | null }
      : {}),
    ...(Object.hasOwn(value, "followUp")
      ? { followUp: value.followUp as number | null }
      : {}),
    ...(value.state === undefined ? {} : { state: value.state }),
    ...(value.resolutionNote === undefined
      ? {}
      : { resolutionNote: value.resolutionNote }),
  };
}

export function decodeUpNext(value: unknown): Decoded<{ moves: string[] }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["moves"]) ||
    !Array.isArray(value.moves) ||
    !value.moves.every((move) => typeof move === "string")
  ) {
    return undefined;
  }

  return { moves: value.moves as string[] };
}

export function decodeCompleteNextMove(value: unknown): Decoded<{
  expectedNextMove: string | null;
  expectedRevision: number;
}> {
  if (
    !isObject(value) ||
    !Object.hasOwn(value, "expectedNextMove") ||
    !Object.hasOwn(value, "expectedRevision") ||
    !isClearableString(value.expectedNextMove) ||
    !isRevision(value.expectedRevision)
  ) {
    return undefined;
  }

  return {
    expectedNextMove: value.expectedNextMove as string | null,
    expectedRevision: value.expectedRevision as number,
  };
}

export function decodeCreateNote(value: unknown): Decoded<{
  body: string;
  attentionDate?: number;
}> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["body", "attentionDate"]) ||
    typeof value.body !== "string" ||
    (value.attentionDate !== undefined && !isTimestamp(value.attentionDate))
  ) {
    return undefined;
  }

  return {
    body: value.body,
    ...(value.attentionDate === undefined
      ? {}
      : { attentionDate: value.attentionDate as number }),
  };
}

export function decodeBody(value: unknown): Decoded<{ body: string }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["body"]) ||
    typeof value.body !== "string"
  ) {
    return undefined;
  }

  return { body: value.body };
}

export function decodeAttentionDate(
  value: unknown,
): Decoded<{ attentionDate: number | null }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["attentionDate"]) ||
    !Object.hasOwn(value, "attentionDate") ||
    !isClearableTimestamp(value.attentionDate)
  ) {
    return undefined;
  }

  return { attentionDate: value.attentionDate as number | null };
}

export function decodeNoteState(value: unknown): Decoded<{ state: NoteState }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["state"]) ||
    !isNoteState(value.state)
  ) {
    return undefined;
  }

  return { state: value.state };
}

/**
 * A bounded page size. Pages are capped so a caller cannot ask for an unbounded
 * read, and an unreadable value is refused rather than quietly replaced.
 */
export function decodeLimit(
  value: string | undefined,
  options: { fallback: number; maximum: number },
): Decoded<number> {
  if (value === undefined) return options.fallback;

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > options.maximum) {
    return undefined;
  }

  return limit;
}

/**
 * How large a page may be, per history.
 *
 * A caller that names no size gets the fallback; one that asks for more than the
 * maximum is refused rather than quietly served less, so an unbounded read cannot
 * be requested by accident.
 */
export const ACTIVITY_PAGE_SIZE = { fallback: 20, maximum: 50 };

export const NOTE_PAGE_SIZE = { fallback: 20, maximum: 50 };
