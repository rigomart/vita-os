import type * as v from "valibot";

import type {
  ActivityLogEntrySchema,
  ActivityLogEntryTypeSchema,
  ActivityLogPageSchema,
  AreaIconSchema,
  AreaSummarySchema,
  NoteAddedToThreadSchema,
  NotePageSchema,
  NoteSchema,
  NoteStateSchema,
  RepeatSchema,
  TaskSchema,
  ThreadDetailSchema,
  ThreadNotePageSchema,
  ThreadNoteSchema,
  ThreadSchema,
  ThreadStateSchema,
} from "./schemas";

/** Plain boundary values. Unset optional properties are absent, never null. */
export type AreaIcon = v.InferOutput<typeof AreaIconSchema>;
export type AreaSummary = v.InferOutput<typeof AreaSummarySchema>;
export type ThreadState = v.InferOutput<typeof ThreadStateSchema>;
export type Thread = v.InferOutput<typeof ThreadSchema>;
/** One useful action, optionally dated; focus is emphasis within its Thread. */
export type Task = v.InferOutput<typeof TaskSchema>;
/** A calendar rhythm on a dated Task; Sunday is weekday 0. */
export type Repeat = v.InferOutput<typeof RepeatSchema>;
export type ThreadDetail = v.InferOutput<typeof ThreadDetailSchema>;
export type NoteState = v.InferOutput<typeof NoteStateSchema>;
/** A Standalone Note, attached to no Thread. */
export type Note = v.InferOutput<typeof NoteSchema>;
/** A Note captured inside one Thread, and owned by it. */
export type ThreadNote = v.InferOutput<typeof ThreadNoteSchema>;
export type NoteAddedToThread = v.InferOutput<typeof NoteAddedToThreadSchema>;
/** next_move_change remains readable in historical entries. */
export type ActivityLogEntryType = v.InferOutput<
  typeof ActivityLogEntryTypeSchema
>;
export type ActivityLogEntry = v.InferOutput<typeof ActivityLogEntrySchema>;

/** A missing cursor means the bounded history is exhausted. */
export interface Page<TEntry> {
  entries: TEntry[];
  nextCursor?: string;
}
export type ActivityLogPage = v.InferOutput<typeof ActivityLogPageSchema>;
export type NotePage = v.InferOutput<typeof NotePageSchema>;
export type ThreadNotePage = v.InferOutput<typeof ThreadNotePageSchema>;
