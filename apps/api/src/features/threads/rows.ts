import type { AreaId, Thread, ThreadId } from "@vita-os/contracts";

/**
 * Where a stored Thread becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const THREAD_COLUMNS =
  "id, title, slug, summary, area_id, sort_order, state, next_move, " +
  "up_next_json, follow_up, last_activity_at, last_activity_content, " +
  "created_at, revision";

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
