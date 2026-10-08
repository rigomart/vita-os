/**
 * Opaque record identity.
 *
 * Every Vita OS record is named by a string the application never interprets:
 * IDs written before the cloud database stay valid, and
 * newly created records carry application-generated collision-resistant text.
 * The brands exist so a Thread ID cannot be passed where an Area ID belongs;
 * they carry no runtime representation.
 */

declare const threadIdBrand: unique symbol;
declare const areaIdBrand: unique symbol;
declare const noteIdBrand: unique symbol;
declare const threadNoteIdBrand: unique symbol;
declare const activityLogEntryIdBrand: unique symbol;
declare const taskIdBrand: unique symbol;

/** Named brand interfaces let declarations describe schema-inferred IDs. */
export interface ThreadIdBrand {
  readonly [threadIdBrand]: "ThreadId";
}
export type ThreadId = string & ThreadIdBrand;
export interface AreaIdBrand {
  readonly [areaIdBrand]: "AreaId";
}
export type AreaId = string & AreaIdBrand;
export interface NoteIdBrand {
  readonly [noteIdBrand]: "NoteId";
}
export type NoteId = string & NoteIdBrand;
export interface ThreadNoteIdBrand {
  readonly [threadNoteIdBrand]: "ThreadNoteId";
}
export type ThreadNoteId = string & ThreadNoteIdBrand;
export interface ActivityLogEntryIdBrand {
  readonly [activityLogEntryIdBrand]: "ActivityLogEntryId";
}
export type ActivityLogEntryId = string & ActivityLogEntryIdBrand;
/**
 * A Task is named within its Thread, not across the database. The caller that
 * adds a Task mints its ID, so a Task shown optimistically keeps the name every
 * later command uses for it.
 */
export interface TaskIdBrand {
  readonly [taskIdBrand]: "TaskId";
}
export type TaskId = string & TaskIdBrand;
