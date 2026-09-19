import type {
  ActivityLogEntry,
  ActivityLogPage,
  AreaSummary,
  Thread,
  ThreadDetail,
} from "@vita-os/contracts";

import type { WorkerEnv } from "./env";

import { encodeActivityCursor, type ActivityCursor } from "./activity-cursor";

type DetailRow = {
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
  area_result_id: string;
  area_name: string;
  area_slug: string;
  area_standard: string | null;
  area_condition: AreaSummary["condition"];
  area_icon: AreaSummary["icon"];
  area_sort_order: number;
  area_created_at: number;
};

type ActivityRow = {
  id: string;
  type: ActivityLogEntry["type"];
  content: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: number;
};

function parseUpNext(value: string | null): string[] | undefined {
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

export class D1ThreadStore {
  constructor(private readonly database: WorkerEnv["DB"]) {}

  async getThreadDetail(input: {
    actorId: string;
    slug: string;
  }): Promise<ThreadDetail | null> {
    const row = await this.database
      .prepare(
        `SELECT
          t.id, t.title, t.slug, t.summary, t.area_id, t.sort_order, t.state,
          t.next_move, t.up_next_json, t.follow_up, t.last_activity_at,
          t.last_activity_content, t.created_at,
          a.id AS area_result_id, a.name AS area_name, a.slug AS area_slug,
          a.standard AS area_standard, a.condition AS area_condition,
          a.icon AS area_icon, a.sort_order AS area_sort_order,
          a.created_at AS area_created_at
        FROM threads t
        JOIN areas a ON a.id = t.area_id AND a.user_id = ?
        WHERE t.user_id = ? AND t.slug = ?
        LIMIT 1`,
      )
      .bind(input.actorId, input.actorId, input.slug)
      .first<DetailRow>();

    if (row === null) return null;

    const upNext = parseUpNext(row.up_next_json);
    return {
      thread: {
        _id: row.id,
        title: row.title,
        slug: row.slug,
        areaId: row.area_id,
        order: row.sort_order,
        state: row.state,
        createdAt: row.created_at,
        ...(row.summary === null ? {} : { summary: row.summary }),
        ...(row.next_move === null ? {} : { nextMove: row.next_move }),
        ...(upNext === undefined ? {} : { upNext }),
        ...(row.follow_up === null ? {} : { followUp: row.follow_up }),
        ...(row.last_activity_at === null
          ? {}
          : { lastActivityAt: row.last_activity_at }),
        ...(row.last_activity_content === null
          ? {}
          : { lastActivityContent: row.last_activity_content }),
      },
      area: {
        _id: row.area_result_id,
        name: row.area_name,
        slug: row.area_slug,
        condition: row.area_condition,
        icon: row.area_icon,
        order: row.area_sort_order,
        createdAt: row.area_created_at,
        ...(row.area_standard === null ? {} : { standard: row.area_standard }),
      },
    };
  }

  async getThreadActivityPage(input: {
    actorId: string;
    threadId: string;
    limit: number;
    cursor?: ActivityCursor;
  }): Promise<ActivityLogPage | null> {
    const thread = await this.database
      .prepare("SELECT id FROM threads WHERE user_id = ? AND id = ? LIMIT 1")
      .bind(input.actorId, input.threadId)
      .first<{ id: string }>();
    if (thread === null) return null;

    const cursor = input.cursor;
    const result = await this.database
      .prepare(
        `SELECT id, type, content, previous_value, new_value, created_at
        FROM activity_log_entries
        WHERE user_id = ? AND thread_id = ?
          AND (
            ? IS NULL
            OR created_at < ?
            OR (created_at = ? AND id < ?)
          )
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      )
      .bind(
        input.actorId,
        input.threadId,
        cursor?.createdAt ?? null,
        cursor?.createdAt ?? null,
        cursor?.createdAt ?? null,
        cursor?.id ?? null,
        input.limit + 1,
      )
      .all<ActivityRow>();
    const rows: ActivityRow[] = result.results;

    const entries = rows.slice(0, input.limit).map((row) => ({
      _id: row.id,
      type: row.type,
      content: row.content,
      createdAt: row.created_at,
      ...(row.previous_value === null
        ? {}
        : { previousValue: row.previous_value }),
      ...(row.new_value === null ? {} : { newValue: row.new_value }),
    }));
    const lastEntry = entries.at(-1);

    return {
      entries,
      ...(rows.length <= input.limit || lastEntry === undefined
        ? {}
        : {
            nextCursor: encodeActivityCursor({
              createdAt: lastEntry.createdAt,
              id: lastEntry._id,
            }),
          }),
    };
  }
}
