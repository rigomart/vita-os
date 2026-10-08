import * as v from "valibot";

import type {
  ActivityLogEntryId,
  AreaId,
  NoteId,
  TaskId,
  ThreadId,
  ThreadNoteId,
} from "./ids";

/** Existing IDs are nonempty opaque strings; preserve their public brands. */
export const ThreadIdSchema = v.custom<ThreadId>(
  (value) => typeof value === "string" && value.length > 0,
);
export const AreaIdSchema = v.custom<AreaId>(
  (value) => typeof value === "string" && value.length > 0,
);
export const NoteIdSchema = v.custom<NoteId>(
  (value) => typeof value === "string" && value.length > 0,
);
export const ThreadNoteIdSchema = v.custom<ThreadNoteId>(
  (value) => typeof value === "string" && value.length > 0,
);
export const ActivityLogEntryIdSchema = v.custom<ActivityLogEntryId>(
  (value) => typeof value === "string" && value.length > 0,
);
export const TaskIdSchema = v.custom<TaskId>(
  (value) => typeof value === "string" && value.length > 0,
);

/** Whole milliseconds, including stored dates outside new-write bounds. */
export const Timestamp = v.pipe(v.number(), v.integer());
export const AreaIconSchema = v.picklist([
  "Compass",
  "HeartPulse",
  "Dumbbell",
  "Users",
  "Home",
  "BriefcaseBusiness",
  "WalletCards",
  "BookOpen",
  "Utensils",
  "Car",
  "CalendarDays",
  "Palette",
  "Leaf",
  "Shield",
  "Plane",
]);
export const ThreadStateSchema = v.picklist(["open", "resolved"]);
export const NoteStateSchema = v.picklist(["open", "done"]);
export const ActivityLogEntryTypeSchema = v.picklist([
  "area_move",
  "next_move_change",
  "move_completed",
  "state_change",
  "follow_up_change",
]);

export const AreaSummarySchema = v.object({
  _id: AreaIdSchema,
  name: v.string(),
  slug: v.string(),
  icon: AreaIconSchema,
  order: Timestamp,
  createdAt: Timestamp,
});

/** Core decides which rhythms are valid and how to canonicalize them. */
export const RepeatSchema = v.union([
  v.object({ kind: v.literal("days"), every: v.number() }),
  v.object({ kind: v.literal("weekly"), weekdays: v.array(v.number()) }),
]);
export const TaskSchema = v.object({
  _id: TaskIdSchema,
  text: v.string(),
  date: v.optional(Timestamp),
  repeat: v.optional(RepeatSchema),
});
export const ThreadSchema = v.object({
  _id: ThreadIdSchema,
  title: v.string(),
  slug: v.string(),
  summary: v.optional(v.string()),
  areaId: v.optional(AreaIdSchema),
  order: Timestamp,
  state: ThreadStateSchema,
  tasks: v.optional(v.array(TaskSchema)),
  focusedTaskId: v.optional(TaskIdSchema),
  lastActivityAt: v.optional(Timestamp),
  lastActivityContent: v.optional(v.string()),
  createdAt: Timestamp,
});
export const ThreadDetailSchema = v.object({
  thread: ThreadSchema,
  area: v.optional(AreaSummarySchema),
});
export const NoteSchema = v.object({
  _id: NoteIdSchema,
  body: v.string(),
  followUp: v.optional(Timestamp),
  state: NoteStateSchema,
  completedAt: v.optional(Timestamp),
  createdAt: Timestamp,
  updatedAt: v.optional(Timestamp),
});
export const ThreadNoteSchema = v.object({
  _id: ThreadNoteIdSchema,
  body: v.string(),
  state: NoteStateSchema,
  completedAt: v.optional(Timestamp),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export const NoteAddedToThreadSchema = v.object({
  thread: ThreadSchema,
  threadNote: ThreadNoteSchema,
});
export const ActivityLogEntrySchema = v.object({
  _id: ActivityLogEntryIdSchema,
  type: ActivityLogEntryTypeSchema,
  content: v.string(),
  previousValue: v.optional(v.string()),
  newValue: v.optional(v.string()),
  createdAt: Timestamp,
});
export const ActivityLogPageSchema = v.object({
  entries: v.array(ActivityLogEntrySchema),
  nextCursor: v.optional(v.string()),
});
export const NotePageSchema = v.object({
  entries: v.array(NoteSchema),
  nextCursor: v.optional(v.string()),
});
export const ThreadNotePageSchema = v.object({
  entries: v.array(ThreadNoteSchema),
  nextCursor: v.optional(v.string()),
});
export const CommandAckSchema = v.object({ acknowledged: v.literal(true) });
export const ApplicationErrorSchema = v.object({
  code: v.picklist([
    "unauthorized",
    "not_found",
    "validation",
    "conflict",
    "unavailable",
    "unexpected",
  ]),
  message: v.string(),
  retryable: v.boolean(),
});
