import {
  CreateNoteBody as SharedCreateNoteBody,
  NoteFollowUp as SharedNoteFollowUp,
} from "@vita-os/contracts";
import * as v from "valibot";

import type { PageSize } from "../../platform/http/decode";

import { TaskDateSchema } from "../threads/requests";

/** Done Notes only grow, so both kinds of Note page them at this size. */
export const NOTE_PAGE_SIZE: PageSize = { fallback: 20, maximum: 50 };

export const CreateNoteBody = v.strictObject({
  ...SharedCreateNoteBody.entries,
  followUp: v.optional(TaskDateSchema),
});
export const NoteFollowUp = v.strictObject({
  ...SharedNoteFollowUp.entries,
  followUp: v.nullable(TaskDateSchema),
});
