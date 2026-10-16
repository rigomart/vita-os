import * as v from "valibot";

/**
 * The file a person downloads with all of their data: the owner's rows of each
 * product table in `schema.ts`, column for column as stored, without `user_id`.
 * Tasks travel inside `threads.moves_json`, as they are stored.
 *
 * `migration` names the newest migration applied to the database the rows came
 * from, so an import can tell whether its own tables have the same shape.
 *
 * Decoding is strict: an unknown key, a missing column or a value its column
 * could not hold is refused. That includes integers above 2^53, which D1 hands
 * back imprecisely and libsql can't read back at all.
 */

export const EXPORT_FORMAT = "vita-os-export";

const Integer = v.pipe(v.number(), v.safeInteger());
const Id = v.pipe(v.string(), v.minLength(1));
const NoteState = v.picklist(["open", "done"]);

/** Mirrors the `json_valid` check on `threads.moves_json`. */
const JsonText = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, "Expected JSON text."),
);

export const ExportedAreaSchema = v.strictObject({
  id: Id,
  name: v.string(),
  slug: v.string(),
  icon: v.string(),
  sort_order: Integer,
  created_at: Integer,
});

export const ExportedThreadSchema = v.strictObject({
  id: Id,
  area_id: v.nullable(Id),
  title: v.string(),
  slug: v.string(),
  summary: v.nullable(v.string()),
  sort_order: Integer,
  state: v.picklist(["open", "resolved"]),
  last_activity_at: v.nullable(Integer),
  last_activity_content: v.nullable(v.string()),
  created_at: Integer,
  revision: Integer,
  last_change_token: v.nullable(v.string()),
  moves_json: v.nullable(JsonText),
  focused_move_id: v.nullable(v.string()),
});

export const ExportedActivityLogEntrySchema = v.strictObject({
  id: Id,
  thread_id: Id,
  type: v.picklist([
    "area_move",
    "next_move_change",
    "move_completed",
    "state_change",
    "follow_up_change",
  ]),
  content: v.string(),
  previous_value: v.nullable(v.string()),
  new_value: v.nullable(v.string()),
  created_at: Integer,
});

export const ExportedNoteSchema = v.strictObject({
  id: Id,
  body: v.string(),
  attention_date: v.nullable(Integer),
  state: NoteState,
  completed_at: v.nullable(Integer),
  created_at: Integer,
  updated_at: v.nullable(Integer),
  repeat: v.nullable(v.string()),
});

export const ExportedThreadNoteSchema = v.strictObject({
  id: Id,
  thread_id: Id,
  body: v.string(),
  state: NoteState,
  completed_at: v.nullable(Integer),
  created_at: Integer,
  updated_at: Integer,
});

export const ExportFileSchema = v.strictObject({
  format: v.literal(EXPORT_FORMAT),
  migration: v.pipe(v.string(), v.minLength(1)),
  exportedAt: Integer,
  areas: v.array(ExportedAreaSchema),
  threads: v.array(ExportedThreadSchema),
  activity_log_entries: v.array(ExportedActivityLogEntrySchema),
  notes: v.array(ExportedNoteSchema),
  thread_notes: v.array(ExportedThreadNoteSchema),
});

export type ExportFile = v.InferOutput<typeof ExportFileSchema>;
