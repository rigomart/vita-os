import type { CreateNoteInput, SetNoteRepeatInput } from "@vita-os/contracts";

import {
  CompleteNoteBody as SharedCompleteNoteBody,
  CreateNoteBody as SharedCreateNoteBody,
  NoteFollowUp as SharedNoteFollowUp,
  SetNoteRepeatBody as SharedSetNoteRepeatBody,
} from "@vita-os/contracts";
import { requireRepeat } from "@vita-os/core";
import * as v from "valibot";

import {
  RepeatSchema,
  TaskDateSchema,
  TimeZoneSchema,
} from "../threads/requests";

export const CreateNoteBody = v.strictObject({
  ...SharedCreateNoteBody.entries,
  followUp: v.optional(TaskDateSchema),
  repeat: v.optional(RepeatSchema),
  timeZone: v.optional(TimeZoneSchema),
});
export const NoteFollowUp = v.strictObject({
  ...SharedNoteFollowUp.entries,
  followUp: v.nullable(TaskDateSchema),
  timeZone: v.optional(TimeZoneSchema),
});
export const SetNoteRepeatBody = v.strictObject({
  ...SharedSetNoteRepeatBody.entries,
  repeat: v.nullable(RepeatSchema),
  timeZone: TimeZoneSchema,
});
export const CompleteNoteBody = v.strictObject({
  ...SharedCompleteNoteBody.entries,
  timeZone: TimeZoneSchema,
});

export function normalizeCreateNote(
  input: v.InferOutput<typeof CreateNoteBody>,
): CreateNoteInput {
  const { repeat, ...rest } = input;
  return {
    ...rest,
    ...(repeat === undefined ? {} : { repeat: requireRepeat(repeat) }),
  };
}

export function normalizeSetNoteRepeat(
  input: v.InferOutput<typeof SetNoteRepeatBody>,
): Omit<SetNoteRepeatInput, "noteId"> {
  return {
    ...input,
    repeat: input.repeat === null ? null : requireRepeat(input.repeat),
  };
}
