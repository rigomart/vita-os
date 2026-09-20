import type {
  ActivityLogEntry,
  ActivityLogEntryId,
  AreaId,
  AreaSummary,
  Note,
  NoteId,
  Thread,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

/**
 * The one place a stored row becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one. Every mapper here reads a nullable column as an
 * absent property, so the distinction the product has always made survives the
 * database change. IDs and timestamps are passed through untouched.
 */

/**
 * The columns each read selects. `user_id` is absent from every one of them: the
 * owner is how a read is scoped, never something a read hands back.
 */
export const AREA_COLUMNS =
  "id, name, slug, standard, condition, icon, sort_order, created_at";

export const THREAD_COLUMNS =
  "id, title, slug, summary, area_id, sort_order, state, next_move, " +
  "up_next_json, follow_up, last_activity_at, last_activity_content, " +
  "created_at, revision";

export const NOTE_COLUMNS =
  "id, body, attention_date, state, completed_at, created_at, updated_at";

export const THREAD_NOTE_COLUMNS =
  "id, body, state, completed_at, created_at, updated_at";

export const ACTIVITY_COLUMNS =
  "id, type, content, previous_value, new_value, created_at";

export interface AreaRow {
  id: string;
  name: string;
  slug: string;
  standard: string | null;
  condition: AreaSummary["condition"];
  icon: AreaSummary["icon"];
  sort_order: number;
  created_at: number;
}

export interface ThreadRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  area_id: string;
  sort_order: number;
  state: Thread["state"];
  next_move: string | null;
  up_next_json: string | null;
  follow_up: number | null;
  last_activity_at: number | null;
  last_activity_content: string | null;
  created_at: number;
  revision: number;
}

export interface NoteRow {
  id: string;
  body: string;
  attention_date: number | null;
  state: Note["state"];
  completed_at: number | null;
  created_at: number;
  updated_at: number | null;
}

export interface ThreadNoteRow {
  id: string;
  body: string;
  state: ThreadNote["state"];
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ActivityRow {
  id: string;
  type: ActivityLogEntry["type"];
  content: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: number;
}

/**
 * Up Next as the Thread stores it: SQL NULL, or a non-empty JSON array of
 * strings. An empty array is never stored, so reading one back means the row
 * was written by something that does not honor the invariant.
 */
export function parseUpNext(value: string | null): string[] | undefined {
  if (value === null) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Stored Up Next must be valid JSON");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every((item) => typeof item === "string")
  ) {
    throw new Error("Stored Up Next must be a non-empty string array");
  }

  return parsed;
}

export function serializeUpNext(
  moves: readonly string[] | undefined,
): string | null {
  return moves === undefined || moves.length === 0
    ? null
    : JSON.stringify([...moves]);
}

export function toAreaSummary(row: AreaRow): AreaSummary {
  return {
    _id: row.id as AreaId,
    name: row.name,
    slug: row.slug,
    ...(row.standard === null ? {} : { standard: row.standard }),
    condition: row.condition,
    icon: row.icon,
    order: row.sort_order,
    createdAt: row.created_at,
  };
}

export function toThread(row: ThreadRow): Thread {
  const upNext = parseUpNext(row.up_next_json);

  return {
    _id: row.id as ThreadId,
    title: row.title,
    slug: row.slug,
    ...(row.summary === null ? {} : { summary: row.summary }),
    areaId: row.area_id as AreaId,
    order: row.sort_order,
    state: row.state,
    ...(row.next_move === null ? {} : { nextMove: row.next_move }),
    ...(upNext === undefined ? {} : { upNext }),
    ...(row.follow_up === null ? {} : { followUp: row.follow_up }),
    ...(row.last_activity_at === null
      ? {}
      : { lastActivityAt: row.last_activity_at }),
    ...(row.last_activity_content === null
      ? {}
      : { lastActivityContent: row.last_activity_content }),
    createdAt: row.created_at,
    revision: row.revision,
  };
}

export function toNote(row: NoteRow): Note {
  return {
    _id: row.id as NoteId,
    body: row.body,
    ...(row.attention_date === null ? {} : { when: row.attention_date }),
    state: row.state,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    createdAt: row.created_at,
    ...(row.updated_at === null ? {} : { updatedAt: row.updated_at }),
  };
}

export function toThreadNote(row: ThreadNoteRow): ThreadNote {
  return {
    _id: row.id as ThreadNoteId,
    body: row.body,
    state: row.state,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toActivityLogEntry(row: ActivityRow): ActivityLogEntry {
  return {
    _id: row.id as ActivityLogEntryId,
    type: row.type,
    content: row.content,
    ...(row.previous_value === null
      ? {}
      : { previousValue: row.previous_value }),
    ...(row.new_value === null ? {} : { newValue: row.new_value }),
    createdAt: row.created_at,
  };
}
