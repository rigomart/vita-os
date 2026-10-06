import type { TaskId, ThreadId, UpdateThreadInput } from "@vita-os/contracts";

import { Schema } from "effect";

import { Revision, Timestamp } from "../../platform/http/schemas";
import { AreaIdSchema } from "../areas/requests";

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
/**
 * Compatibility (ADR 0032, removal in #402): `followUp` is still accepted by
 * the schema so an old client's request reaches the refusal that tells it to
 * reload; it is never written.
 */
export const UpdateThreadBody = Schema.Struct({
  title: Schema.optional(Schema.String),
  summary: Schema.optionalKey(Schema.NullOr(Schema.String)),
  areaId: Schema.optionalKey(Schema.NullOr(AreaIdSchema)),
  followUp: Schema.optionalKey(Schema.NullOr(Timestamp)),
  state: Schema.optional(Schema.Literals(["open", "resolved"])),
  resolutionNote: Schema.optional(Schema.String),
});
/**
 * Compatibility (ADR 0033, removal in #402): a request may spell the Task's ID
 * with the old field name `moveId` instead of `taskId`. Exactly one is allowed;
 * naming both is ambiguous, as `attentionDate` and `followUp` were in ADR 0028.
 */
const namesOneTaskId = Schema.makeFilter(
  (input: { taskId?: unknown; moveId?: unknown }) =>
    Object.hasOwn(input, "taskId") !== Object.hasOwn(input, "moveId"),
);

/** The former `/moves` add: no date, which only Tasks carry. */
export const AddMoveBody = Schema.Struct({
  taskId: Schema.optionalKey(TaskIdSchema),
  moveId: Schema.optionalKey(TaskIdSchema),
  text: Schema.String,
  expectedRevision: Revision,
}).check(namesOneTaskId);
/** A new Task may arrive already dated: the card's "Follow up" is one action. */
export const AddTaskBody = Schema.Struct({
  taskId: Schema.optionalKey(TaskIdSchema),
  moveId: Schema.optionalKey(TaskIdSchema),
  text: Schema.String,
  date: Schema.optionalKey(Timestamp),
  expectedRevision: Revision,
}).check(namesOneTaskId);
export const EditTaskBody = Schema.Struct({
  text: Schema.String,
  expectedRevision: Revision,
});
/** `date: null` clears the Task's date, and must be spelled out: absent is not a choice. */
export const SetTaskDateBody = Schema.Struct({
  date: Schema.NullOr(Timestamp),
  expectedRevision: Revision,
});
/** Removing and completing name the Task in the path; the body holds only the revision. */
export const TaskRevisionBody = Schema.Struct({ expectedRevision: Revision });
/**
 * `taskId: null` unfocuses, and must be spelled out: absent is not a choice.
 * The old field name `moveId` is accepted for compatibility, never both.
 */
export const FocusTaskBody = Schema.Struct({
  taskId: Schema.optionalKey(Schema.NullOr(TaskIdSchema)),
  moveId: Schema.optionalKey(Schema.NullOr(TaskIdSchema)),
  expectedRevision: Revision,
}).check(namesOneTaskId);

export function normalizeAddTask(
  input: typeof AddTaskBody.Type | typeof AddMoveBody.Type,
): {
  taskId: TaskId;
  text: string;
  date?: number;
  expectedRevision: number;
} {
  // namesOneTaskId guarantees exactly one of the two spellings is present.
  return {
    taskId: (Object.hasOwn(input, "taskId")
      ? input.taskId
      : input.moveId) as TaskId,
    text: input.text,
    ...("date" in input && input.date !== undefined
      ? { date: input.date }
      : {}),
    expectedRevision: input.expectedRevision,
  };
}

export function normalizeFocusTask(input: typeof FocusTaskBody.Type): {
  taskId: TaskId | null;
  expectedRevision: number;
} {
  return {
    taskId: (Object.hasOwn(input, "taskId")
      ? input.taskId
      : input.moveId) as TaskId | null,
    expectedRevision: input.expectedRevision,
  };
}

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
