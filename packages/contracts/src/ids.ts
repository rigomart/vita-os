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
declare const moveIdBrand: unique symbol;

export type ThreadId = string & { readonly [threadIdBrand]: "ThreadId" };
export type AreaId = string & { readonly [areaIdBrand]: "AreaId" };
export type NoteId = string & { readonly [noteIdBrand]: "NoteId" };
export type ThreadNoteId = string & {
  readonly [threadNoteIdBrand]: "ThreadNoteId";
};
export type ActivityLogEntryId = string & {
  readonly [activityLogEntryIdBrand]: "ActivityLogEntryId";
};
/**
 * A Move is named within its Thread, not across the database. The caller that
 * adds a Move mints its ID, so a Move shown optimistically keeps the name every
 * later command uses for it.
 */
export type MoveId = string & { readonly [moveIdBrand]: "MoveId" };
