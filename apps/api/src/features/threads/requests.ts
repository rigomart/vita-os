import type {
  AreaId,
  CompleteNextMoveInput,
  CreateThreadInput,
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

const UPDATE_THREAD_KEYS = [
  "title",
  "summary",
  "areaId",
  "nextMove",
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

export function decodeCompleteNextMove(
  value: unknown,
): Decoded<Omit<CompleteNextMoveInput, "threadId">> {
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
