import * as v from "valibot";

import {
  AreaIconSchema,
  AreaIdSchema,
  NoteStateSchema,
  RepeatSchema,
  TaskIdSchema,
  ThreadIdSchema,
  ThreadNoteIdSchema,
  ThreadStateSchema,
  Timestamp,
} from "./schemas";

/** JSON request objects reject unknown keys; optional keys have no defaults. */
export const CreateThreadBody = v.strictObject({
  title: v.string(),
  summary: v.optional(v.string()),
  areaId: v.optional(AreaIdSchema),
});
export const UpdateThreadBody = v.strictObject({
  title: v.optional(v.string()),
  summary: v.optional(v.nullable(v.string())),
  areaId: v.optional(v.nullable(AreaIdSchema)),
  state: v.optional(ThreadStateSchema),
  resolutionNote: v.optional(v.string()),
});

/** The API adds core's new-write date bounds and timezone rules. */
export const AddTaskBody = v.strictObject({
  taskId: TaskIdSchema,
  text: v.string(),
  date: v.optional(Timestamp),
});
export const EditTaskBody = v.strictObject({ text: v.string() });
export const SetTaskDateBody = v.strictObject({
  date: v.nullable(Timestamp),
  timeZone: v.optional(v.string()),
});
/** Occurrence identity covers stored legacy dates, including negative ones. */
export const TaskOccurrenceSchema = v.pipe(
  v.number(),
  v.check<number>(Number.isSafeInteger),
);
export const CompleteTaskBody = v.strictObject({
  expectedOccurrence: v.nullable(TaskOccurrenceSchema),
  timeZone: v.optional(v.string()),
  note: v.optional(
    v.strictObject({ id: ThreadNoteIdSchema, body: v.string() }),
  ),
});
/** Reuse the stored rhythm shape while rejecting extra nested request keys. */
export const RequestRepeatSchema = v.union([
  v.strictObject(RepeatSchema.options[0].entries),
  v.strictObject(RepeatSchema.options[1].entries),
]);
export const SetTaskRepeatBody = v.strictObject({
  repeat: v.nullable(RequestRepeatSchema),
  timeZone: v.string(),
});
export const SkipTaskBody = v.strictObject({
  expectedOccurrence: TaskOccurrenceSchema,
  timeZone: v.string(),
});
export const FocusTaskBody = v.strictObject({
  taskId: v.nullable(TaskIdSchema),
});

export const CreateAreaBody = v.strictObject({
  name: v.string(),
  icon: AreaIconSchema,
});
export const UpdateAreaBody = v.strictObject({
  name: v.optional(v.string()),
  icon: v.optional(AreaIconSchema),
});
export const AreaOrderBody = v.strictObject({ areaIds: v.array(AreaIdSchema) });

export const CreateNoteBody = v.strictObject({
  body: v.string(),
  followUp: v.optional(Timestamp),
});
export const NoteBody = v.strictObject({ body: v.string() });
export const NoteFollowUp = v.strictObject({ followUp: v.nullable(Timestamp) });
export const NoteStateBody = v.strictObject({ state: NoteStateSchema });
export const ThreadNoteBody = v.strictObject({ body: v.string() });
export const ThreadNoteStateBody = v.strictObject({ state: NoteStateSchema });

export const AddNoteToThreadBody = v.strictObject({
  threadId: ThreadIdSchema,
  taskId: v.optional(TaskIdSchema),
});
export const CreateThreadFromNoteBody = v.strictObject({
  title: v.string(),
  areaId: v.optional(AreaIdSchema),
  taskId: v.optional(TaskIdSchema),
});

/** Repeated query keys retain the first value, matching the HTTP boundary. */
export const QueryValue = v.pipe(
  v.union([v.string(), v.pipe(v.array(v.string()), v.minLength(1))]),
  v.transform((value) => (typeof value === "string" ? value : value[0])),
);
export const PageQuery = v.object({
  limit: v.optional(QueryValue),
  cursor: v.optional(QueryValue),
});
export const DoneNotesQuery = v.object({
  ...PageQuery.entries,
  q: v.optional(QueryValue),
});
