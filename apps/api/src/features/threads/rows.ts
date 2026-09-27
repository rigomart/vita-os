import type {
  AreaId,
  Move,
  MoveId,
  Thread,
  ThreadId,
} from "@vita-os/contracts";

/**
 * Where a stored Thread becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const THREAD_COLUMNS =
  "id, title, slug, summary, area_id, sort_order, state, moves_json, " +
  "focused_move_id, follow_up, last_activity_at, last_activity_content, " +
  "created_at, revision";

export interface ThreadRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  area_id: string | null;
  sort_order: number;
  state: Thread["state"];
  moves_json: string | null;
  focused_move_id: string | null;
  follow_up: number | null;
  last_activity_at: number | null;
  last_activity_content: string | null;
  created_at: number;
  revision: number;
}

/**
 * Moves as the Thread stores them: SQL NULL, or a non-empty JSON array of
 * `{id, text}` in capture order. An empty array is never stored, so reading one
 * back means the row was written by something that does not honor the rule.
 */
export function parseMoves(value: string | null): Move[] | undefined {
  if (value === null) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Stored Moves must be valid JSON");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.text === "string",
    )
  ) {
    throw new Error("Stored Moves must be a non-empty array of Moves");
  }

  return parsed.map((item: { id: string; text: string }) => ({
    _id: item.id as MoveId,
    text: item.text,
  }));
}

export function serializeMoves(
  moves: readonly Move[] | undefined,
): string | null {
  return moves === undefined || moves.length === 0
    ? null
    : JSON.stringify(moves.map((move) => ({ id: move._id, text: move.text })));
}

export function toThread(row: ThreadRow): Thread {
  const moves = parseMoves(row.moves_json);
  if (
    row.focused_move_id !== null &&
    !moves?.some((move) => move._id === row.focused_move_id)
  ) {
    throw new Error("A stored Focused Move must be one of the Thread's Moves");
  }

  return {
    _id: row.id as ThreadId,
    title: row.title,
    slug: row.slug,
    ...(row.summary === null ? {} : { summary: row.summary }),
    ...(row.area_id === null ? {} : { areaId: row.area_id as AreaId }),
    order: row.sort_order,
    state: row.state,
    ...(moves === undefined ? {} : { moves }),
    ...(row.focused_move_id === null
      ? {}
      : { focusedMoveId: row.focused_move_id as MoveId }),
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
