import type { ThreadNoteId } from "@vita-os/contracts";

import { Schema } from "effect";

export const ThreadNoteIdSchema = Schema.String.pipe(
  Schema.refine((value): value is ThreadNoteId => value.length > 0),
);
export const ThreadNoteBody = Schema.Struct({ body: Schema.String });
export const ThreadNoteStateBody = Schema.Struct({
  state: Schema.Literals(["open", "done"]),
});
