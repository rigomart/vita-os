import type {
  AreaId,
  CreateThreadInput,
  MoveId,
  ThreadState,
  UpdateThreadInput,
} from "@vita-os/contracts";

import type { Decoded } from "../../platform/http/decode";

import {
  hasOnlyKeys,
  isClearableString,
  isClearableTimestamp,
  isNonEmptyString,
  isObject,
  isRevision,
} from "../../platform/http/decode";

function isThreadState(value: unknown): value is ThreadState {
  return value === "open" || value === "resolved";
}

export function decodeCreateThread(value: unknown): Decoded<CreateThreadInput> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["title", "summary", "areaId"]) ||
    typeof value.title !== "string" ||
    (value.areaId !== undefined && !isNonEmptyString(value.areaId)) ||
    (value.summary !== undefined && typeof value.summary !== "string")
  ) {
    return undefined;
  }

  return {
    title: value.title,
    ...(value.summary === undefined ? {} : { summary: value.summary }),
    ...(value.areaId === undefined ? {} : { areaId: value.areaId as AreaId }),
  };
}

const UPDATE_THREAD_KEYS = [
  "title",
  "summary",
  "areaId",
  "followUp",
  "state",
  "resolutionNote",
] as const;

export function decodeUpdateThread(
  value: unknown,
): Decoded<Omit<UpdateThreadInput, "threadId">> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, UPDATE_THREAD_KEYS) ||
    (value.title !== undefined && typeof value.title !== "string") ||
    (Object.hasOwn(value, "summary") && !isClearableString(value.summary)) ||
    (Object.hasOwn(value, "areaId") &&
      value.areaId !== null &&
      !isNonEmptyString(value.areaId)) ||
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
    ...(Object.hasOwn(value, "areaId")
      ? { areaId: value.areaId as AreaId | null }
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

/** Every Move command carries the revision its caller read the Thread at. */
function hasRevision(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { expectedRevision: number } {
  return isRevision(value.expectedRevision);
}

export function decodeAddMove(
  value: unknown,
): Decoded<{ moveId: MoveId; text: string; expectedRevision: number }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["moveId", "text", "expectedRevision"]) ||
    !isNonEmptyString(value.moveId) ||
    typeof value.text !== "string" ||
    !hasRevision(value)
  ) {
    return undefined;
  }

  return {
    moveId: value.moveId as MoveId,
    text: value.text,
    expectedRevision: value.expectedRevision,
  };
}

export function decodeEditMove(
  value: unknown,
): Decoded<{ text: string; expectedRevision: number }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["text", "expectedRevision"]) ||
    typeof value.text !== "string" ||
    !hasRevision(value)
  ) {
    return undefined;
  }

  return { text: value.text, expectedRevision: value.expectedRevision };
}

/** Removing and completing name the Move in the path; the body holds only the revision. */
export function decodeMoveRevision(
  value: unknown,
): Decoded<{ expectedRevision: number }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["expectedRevision"]) ||
    !hasRevision(value)
  ) {
    return undefined;
  }

  return { expectedRevision: value.expectedRevision };
}

/** `moveId: null` unfocuses, and must be spelled out: absent is not a choice. */
export function decodeFocusMove(
  value: unknown,
): Decoded<{ moveId: MoveId | null; expectedRevision: number }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["moveId", "expectedRevision"]) ||
    !Object.hasOwn(value, "moveId") ||
    (value.moveId !== null && !isNonEmptyString(value.moveId)) ||
    !hasRevision(value)
  ) {
    return undefined;
  }

  return {
    moveId: value.moveId as MoveId | null,
    expectedRevision: value.expectedRevision,
  };
}
