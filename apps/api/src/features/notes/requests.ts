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
  followUp?: number;
}> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["body", "followUp", "attentionDate"]) ||
    (Object.hasOwn(value, "followUp") &&
      Object.hasOwn(value, "attentionDate")) ||
    typeof value.body !== "string" ||
    (noteFollowUp(value) !== undefined && !isTimestamp(noteFollowUp(value)))
  ) {
    return undefined;
  }

  return {
    body: value.body,
    ...(noteFollowUp(value) === undefined
      ? {}
      : { followUp: noteFollowUp(value) as number }),
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

export function decodeFollowUp(
  value: unknown,
): Decoded<{ followUp: number | null }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["followUp", "attentionDate"]) ||
    Object.hasOwn(value, "followUp") ===
      Object.hasOwn(value, "attentionDate") ||
    !isClearableTimestamp(noteFollowUp(value))
  ) {
    return undefined;
  }

  return { followUp: noteFollowUp(value) as number | null };
}

/** Accept the old web app's field during the API-before-web deployment. */
function noteFollowUp(value: Record<string, unknown>): unknown {
  return Object.hasOwn(value, "followUp")
    ? value.followUp
    : value.attentionDate;
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
