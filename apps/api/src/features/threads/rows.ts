import type {
  AreaId,
  Task,
  TaskId,
  Thread,
  ThreadId,
} from "@vita-os/contracts";

import { requireRepeat, requireTaskDate, soonestTaskDate } from "@vita-os/core";

/**
 * Where a stored Thread becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

// Storage names predate Tasks and stay (ADR 0033): `moves_json` holds the
// Tasks and `focused_move_id` the Focused Task. They are mapped here, at the edge.
export const THREAD_COLUMNS =
  "id, title, slug, summary, area_id, sort_order, state, moves_json, " +
  "focused_move_id, last_activity_at, last_activity_content, " +
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
  last_activity_at: number | null;
  last_activity_content: string | null;
  created_at: number;
  revision: number;
}

/**
 * Tasks as the Thread stores them: SQL NULL, or a non-empty JSON array of
 * `{id, text, date?, repeat?}` in capture order. An empty array is never stored, so reading one
 * back means the row was written by something that does not honor the rule.
 */
export function parseTasks(value: string | null): Task[] | undefined {
  if (value === null) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Stored Tasks must be valid JSON");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        (item.date === undefined || Number.isSafeInteger(item.date)),
    )
  ) {
    throw new Error("Stored Tasks must be a non-empty array of Tasks");
  }

  return parsed.map(
    (item: { id: string; text: string; date?: number; repeat?: unknown }) => {
      if (Object.hasOwn(item, "repeat") && item.date === undefined) {
        throw new Error("A stored Repeat requires a date");
      }
      return {
        _id: item.id as TaskId,
        text: item.text,
        ...(item.date === undefined
          ? {}
          : { date: requireTaskDate(item.date) }),
        ...(Object.hasOwn(item, "repeat")
          ? { repeat: requireRepeat(item.repeat) }
          : {}),
      };
    },
  );
}

export function serializeTasks(
  tasks: readonly Task[] | undefined,
): string | null {
  return tasks === undefined || tasks.length === 0
    ? null
    : JSON.stringify(
        tasks.map((task) => ({
          id: task._id,
          text: task.text,
          ...(task.date === undefined ? {} : { date: task.date }),
          ...(task.repeat === undefined
            ? {}
            : { repeat: requireRepeat(task.repeat) }),
        })),
      );
}

/**
 * Compatibility (ADR 0033, removal in #402): a Thread read also carries the old
 * names for its Tasks, with the same values, until older clients have reloaded.
 */
export type ThreadWithOldNames = Thread & {
  moves?: Task[];
  focusedMoveId?: TaskId;
  /**
   * Compatibility (ADR 0032, removal in #402): the Thread's former Follow-up
   * date, derived from its soonest dated Task, until older clients have
   * reloaded. The `threads.follow_up` column is no longer read or written.
   */
  followUp?: number;
};

/** Storage keeps `moves_json` and `focused_move_id`; the domain says Tasks. */
export function toThread(row: ThreadRow): ThreadWithOldNames {
  const tasks = parseTasks(row.moves_json);
  if (
    row.focused_move_id !== null &&
    !tasks?.some((task) => task._id === row.focused_move_id)
  ) {
    throw new Error("A stored Focused Task must be one of the Thread's Tasks");
  }

  const soonestDate = soonestTaskDate(tasks);

  return {
    _id: row.id as ThreadId,
    title: row.title,
    slug: row.slug,
    ...(row.summary === null ? {} : { summary: row.summary }),
    ...(row.area_id === null ? {} : { areaId: row.area_id as AreaId }),
    order: row.sort_order,
    state: row.state,
    ...(tasks === undefined ? {} : { tasks, moves: tasks }),
    ...(row.focused_move_id === null
      ? {}
      : {
          focusedTaskId: row.focused_move_id as TaskId,
          focusedMoveId: row.focused_move_id as TaskId,
        }),
    // Compatibility (ADR 0032, removal in #402).
    ...(soonestDate === undefined ? {} : { followUp: soonestDate }),
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
