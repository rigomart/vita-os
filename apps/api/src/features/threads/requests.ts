import type { MoveId, ThreadId, UpdateThreadInput } from "@vita-os/contracts";

import { Schema } from "effect";

import { Revision, Timestamp } from "../../platform/http/schemas";
import { AreaIdSchema } from "../areas/requests";

/** IDs stay opaque strings, including identifiers minted before UUIDs. */
export const ThreadIdSchema = Schema.String.pipe(
  Schema.refine((value): value is ThreadId => value.length > 0),
);
export const MoveIdSchema = Schema.String.pipe(
  Schema.refine((value): value is MoveId => value.length > 0),
);
export const CreateThreadBody = Schema.Struct({
  title: Schema.String,
  summary: Schema.optional(Schema.String),
  areaId: Schema.optional(AreaIdSchema),
});
export const UpdateThreadBody = Schema.Struct({
  title: Schema.optional(Schema.String),
  summary: Schema.optionalKey(Schema.NullOr(Schema.String)),
  areaId: Schema.optionalKey(Schema.NullOr(AreaIdSchema)),
  followUp: Schema.optionalKey(Schema.NullOr(Timestamp)),
  state: Schema.optional(Schema.Literals(["open", "resolved"])),
  resolutionNote: Schema.optional(Schema.String),
});
export const AddMoveBody = Schema.Struct({
  moveId: MoveIdSchema,
  text: Schema.String,
  expectedRevision: Revision,
});
export const EditMoveBody = Schema.Struct({
  text: Schema.String,
  expectedRevision: Revision,
});
/** Removing and completing name the Move in the path; the body holds only the revision. */
export const MoveRevisionBody = Schema.Struct({ expectedRevision: Revision });
/** `moveId: null` unfocuses, and must be spelled out: absent is not a choice. */
export const FocusMoveBody = Schema.Struct({
  moveId: Schema.NullOr(MoveIdSchema),
  expectedRevision: Revision,
});

/** Only present clearable fields enter the domain patch; absence leaves them alone. */
export function normalizeThreadChange(
  input: typeof UpdateThreadBody.Type,
): Omit<UpdateThreadInput, "threadId"> {
  return {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(Object.hasOwn(input, "summary") ? { summary: input.summary } : {}),
    ...(Object.hasOwn(input, "areaId") ? { areaId: input.areaId } : {}),
    ...(Object.hasOwn(input, "followUp") ? { followUp: input.followUp } : {}),
    ...(input.state === undefined ? {} : { state: input.state }),
    ...(input.resolutionNote === undefined
      ? {}
      : { resolutionNote: input.resolutionNote }),
  };
}
