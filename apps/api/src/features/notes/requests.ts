import { Schema } from "effect";

import type { PageSize } from "../../platform/http/decode";

import { PageQuery, QueryValue } from "../../platform/http/schemas";
import { TaskDateSchema } from "../threads/requests";

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

/** Creation accepts an optional date; a present null is never a timestamp. */
export const CreateNoteBody = Schema.Struct({
  body: Schema.String,
  followUp: Schema.optionalKey(TaskDateSchema),
});

export const NoteBody = Schema.Struct({ body: Schema.String });

/** Setting a date requires the field, including when clearing with null. */
export const NoteFollowUp = Schema.Struct({
  followUp: Schema.NullOr(TaskDateSchema),
});

export const NoteStateBody = Schema.Struct({
  state: Schema.Literals(["open", "done"]),
});
