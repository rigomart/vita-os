import type {
  SetTaskRepeatInput,
  TaskId,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";

import {
  MAX_TASK_DATE,
  MIN_TASK_DATE,
  requireRepeat,
  requireTaskId,
  requireTimeZone,
} from "@vita-os/core";
import { Schema } from "effect";

import { Revision, Timestamp } from "../../platform/http/schemas";
import { AreaIdSchema } from "../areas/requests";
import { ThreadNoteBody, ThreadNoteIdSchema } from "../thread-notes/requests";

/** IDs stay opaque strings, including identifiers minted before UUIDs. */
export const ThreadIdSchema = Schema.String.pipe(
  Schema.refine((value): value is ThreadId => value.length > 0),
);
export const TaskIdSchema = Schema.String.pipe(
  Schema.refine((value): value is TaskId => value.length > 0),
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
  state: Schema.optional(Schema.Literals(["open", "resolved"])),
  resolutionNote: Schema.optional(Schema.String),
});
/** A Task's date: whole milliseconds, 1970 through 9999 (core's bound). */
export const TaskDateSchema = Timestamp.check(
  Schema.isGreaterThanOrEqualTo(MIN_TASK_DATE),
  Schema.isLessThanOrEqualTo(MAX_TASK_DATE),
);

const TimeZoneSchema = Schema.String.check(
  Schema.makeFilter((value) => {
    try {
      requireTimeZone(value);
      return true;
    } catch {
      return false;
    }
  }),
);

/** A new Task may arrive already dated: the card's "Follow up" is one action. */
export const AddTaskBody = Schema.Struct({
  taskId: TaskIdSchema,
  text: Schema.String,
  date: Schema.optionalKey(TaskDateSchema),
  expectedRevision: Revision,
});
export const EditTaskBody = Schema.Struct({
  text: Schema.String,
  expectedRevision: Revision,
});
/** `date: null` clears the Task's date, and must be spelled out: absent is not a choice. */
export const SetTaskDateBody = Schema.Struct({
  date: Schema.NullOr(TaskDateSchema),
  timeZone: Schema.optionalKey(TimeZoneSchema),
  expectedRevision: Revision,
});
/** Removing and completing name the Task in the path; the body holds only the revision. */
export const TaskRevisionBody = Schema.Struct({ expectedRevision: Revision });
export const CompleteTaskBody = Schema.Struct({
  expectedRevision: Revision,
  timeZone: Schema.optionalKey(TimeZoneSchema),
  note: Schema.optionalKey(
    Schema.Struct({
      id: ThreadNoteIdSchema.check(
        Schema.makeFilter((value) => {
          try {
            requireTaskId(value);
            return true;
          } catch {
            return false;
          }
        }),
      ),
      body: ThreadNoteBody.fields.body,
    }),
  ),
});

export const RepeatSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("days"), every: Schema.Number }),
  Schema.Struct({
    kind: Schema.Literal("weekly"),
    weekdays: Schema.Array(Schema.Number),
  }),
]).check(
  Schema.makeFilter((value) => {
    try {
      requireRepeat(value);
      return true;
    } catch {
      return false;
    }
  }),
);

export const SetTaskRepeatBody = Schema.Struct({
  repeat: Schema.NullOr(RepeatSchema),
  timeZone: TimeZoneSchema,
  expectedRevision: Revision,
});
export const SkipTaskBody = Schema.Struct({
  timeZone: TimeZoneSchema,
  expectedRevision: Revision,
});

export function normalizeSetTaskRepeat(
  input: typeof SetTaskRepeatBody.Type,
): Omit<SetTaskRepeatInput, "threadId" | "taskId"> {
  return {
    ...input,
    repeat: input.repeat === null ? null : requireRepeat(input.repeat),
  };
}
/**
 * `taskId: null` unfocuses, and must be spelled out: absent is not a choice.
 */
export const FocusTaskBody = Schema.Struct({
  taskId: Schema.NullOr(TaskIdSchema),
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
    ...(input.state === undefined ? {} : { state: input.state }),
    ...(input.resolutionNote === undefined
      ? {}
      : { resolutionNote: input.resolutionNote }),
  };
}
