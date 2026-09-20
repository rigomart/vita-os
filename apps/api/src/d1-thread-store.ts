import type {
  ActivityLogEntry,
  ActivityLogPage,
  AreaSummary,
  CompleteNextMoveOutput,
  Thread,
  ThreadDetail,
} from "@vita-os/contracts";

import { decideNextMoveCompletion } from "@vita-os/core";

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
  revision: number;
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

type CompletionRow = {
  id: string;
  revision: number;
  next_move: string | null;
  up_next_json: string | null;
};

export type D1CompleteNextMoveOutput =
  | CompleteNextMoveOutput
  | { status: "not_found" }
  | { status: "conflict" };

export interface D1ThreadStoreDependencies {
  now?: () => number;
  newActivityLogId?: () => string;
  newOperationToken?: () => string;
}

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
  private readonly now: () => number;
  private readonly newActivityLogId: () => string;
  private readonly newOperationToken: () => string;

  constructor(
    private readonly database: WorkerEnv["DB"],
    dependencies: D1ThreadStoreDependencies = {},
  ) {
    this.now = dependencies.now ?? Date.now;
    this.newActivityLogId =
      dependencies.newActivityLogId ?? (() => crypto.randomUUID());
    this.newOperationToken =
      dependencies.newOperationToken ?? (() => crypto.randomUUID());
  }

  async getThreadDetail(input: {
    actorId: string;
    slug: string;
  }): Promise<ThreadDetail | null> {
    const row = await this.database
      .prepare(
        `SELECT
          t.id, t.title, t.slug, t.summary, t.area_id, t.sort_order, t.state,
          t.next_move, t.up_next_json, t.follow_up, t.last_activity_at,
          t.last_activity_content, t.created_at, t.revision,
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
        _id: row.id as ThreadDetail["thread"]["_id"],
        title: row.title,
        slug: row.slug,
        areaId: row.area_id as ThreadDetail["thread"]["areaId"],
        order: row.sort_order,
        state: row.state,
        createdAt: row.created_at,
        revision: row.revision,
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
        _id: row.area_result_id as ThreadDetail["area"]["_id"],
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

  async completeNextMove(input: {
    actorId: string;
    threadId: string;
    expectedNextMove: string | null;
    expectedRevision: number;
  }): Promise<D1CompleteNextMoveOutput> {
    const thread = await this.database
      .prepare(
        `SELECT id, revision, next_move, up_next_json
        FROM threads
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      )
      .bind(input.threadId, input.actorId)
      .first<CompletionRow>();
    if (thread === null) return { status: "not_found" };

    if (
      thread.next_move !== input.expectedNextMove ||
      thread.revision !== input.expectedRevision
    ) {
      return { status: "conflict" };
    }

    const decision = decideNextMoveCompletion({
      ...(thread.next_move === null ? {} : { nextMove: thread.next_move }),
      ...(thread.up_next_json === null
        ? {}
        : { upNext: parseUpNext(thread.up_next_json) }),
    });
    if (decision.status === "unchanged") return { status: "unchanged" };

    const completedAt = this.now();
    const activityLogId = this.newActivityLogId();
    const operationToken = this.newOperationToken();
    const [update, insert] = await this.database.batch([
      this.database
        .prepare(
          `UPDATE threads
          SET next_move = ?,
              up_next_json = ?,
              last_activity_at = ?,
              last_activity_content = ?,
              revision = revision + 1,
              last_completion_token = ?
          WHERE id = ?
            AND user_id = ?
            AND revision = ?
            AND next_move IS ?`,
        )
        .bind(
          decision.patch.nextMove ?? null,
          decision.patch.upNext === undefined
            ? null
            : JSON.stringify(decision.patch.upNext),
          completedAt,
          decision.activity.content,
          operationToken,
          thread.id,
          input.actorId,
          input.expectedRevision,
          input.expectedNextMove,
        ),
      this.database
        .prepare(
          `INSERT INTO activity_log_entries (
            id, user_id, thread_id, type, content,
            previous_value, new_value, created_at
          )
          SELECT ?, user_id, id, ?, ?, ?, ?, ?
          FROM threads
          WHERE id = ?
            AND user_id = ?
            AND last_completion_token = ?`,
        )
        .bind(
          activityLogId,
          decision.activity.type,
          decision.activity.content,
          decision.activity.previousValue,
          decision.activity.newValue ?? null,
          completedAt,
          thread.id,
          input.actorId,
          operationToken,
        ),
    ]);

    if (update.meta.changes === 0) return { status: "conflict" };
    if (update.meta.changes !== 1 || insert.meta.changes !== 1) {
      throw new Error("Next Move completion batch had an unexpected result");
    }

    return { status: "completed" };
  }
}
