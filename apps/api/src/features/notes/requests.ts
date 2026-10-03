import { Schema } from "effect";

import type { PageSize } from "../../platform/http/decode";

import { PageQuery, QueryValue, Timestamp } from "../../platform/http/schemas";

/** Done Notes only grow, so both kinds of Note page them at this size. */
export const NOTE_PAGE_SIZE: PageSize = { fallback: 20, maximum: 50 };

/**
 * A page of Archived Notes, stored as Done. `q` narrows it to the Notes whose
 * body contains every word of it.
 */
export const DoneNotesQuery = Schema.Struct({
  ...PageQuery.fields,
  q: Schema.optionalKey(QueryValue),
});

/** Creation accepts no date or one alias; a present null is never a timestamp. */
export const CreateNoteBody = Schema.Struct({
  body: Schema.String,
  followUp: Schema.optionalKey(Timestamp),
  attentionDate: Schema.optionalKey(Timestamp),
}).check(
  Schema.makeFilter(
    (input) =>
      !(
        Object.hasOwn(input, "followUp") &&
        Object.hasOwn(input, "attentionDate")
      ),
  ),
);

export const NoteBody = Schema.Struct({ body: Schema.String });

/** Setting a date requires exactly one field, including when clearing with null. */
export const NoteFollowUp = Schema.Struct({
  followUp: Schema.optionalKey(Schema.NullOr(Timestamp)),
  attentionDate: Schema.optionalKey(Schema.NullOr(Timestamp)),
}).check(
  Schema.makeFilter(
    (input) =>
      Object.hasOwn(input, "followUp") !==
      Object.hasOwn(input, "attentionDate"),
  ),
);

export const NoteStateBody = Schema.Struct({
  state: Schema.Literals(["open", "done"]),
});

/** Accept the old web app's field during the API-before-web deployment. */
export function normalizeCreateNote(input: typeof CreateNoteBody.Type): {
  body: string;
  followUp?: number;
} {
  const followUp = Object.hasOwn(input, "followUp")
    ? input.followUp
    : input.attentionDate;
  return { body: input.body, ...(followUp === undefined ? {} : { followUp }) };
}

export function normalizeNoteFollowUp(input: typeof NoteFollowUp.Type): {
  followUp: number | null;
} {
  // NoteFollowUp's presence check guarantees exactly one nullable timestamp.
  return {
    followUp: (Object.hasOwn(input, "followUp")
      ? input.followUp
      : input.attentionDate) as number | null,
  };
}
