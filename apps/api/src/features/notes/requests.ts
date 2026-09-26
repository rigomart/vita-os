import type { NoteState } from "@vita-os/contracts";

import type { Decoded, PageSize } from "../../platform/http/decode";

import {
  hasOnlyKeys,
  isClearableTimestamp,
  isObject,
  isTimestamp,
} from "../../platform/http/decode";

/** Done Notes only grow, so both kinds of Note page them at this size. */
export const NOTE_PAGE_SIZE: PageSize = { fallback: 20, maximum: 50 };

function isNoteState(value: unknown): value is NoteState {
  return value === "open" || value === "done";
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

/** A Note's body, for either kind of Note. */
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

/** Open or Done, for either kind of Note. */
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
