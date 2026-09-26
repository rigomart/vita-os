import type { Thread, ThreadDetail } from "@vita-os/contracts";
import type { AutoActivityLogEntry, ThreadPatch } from "@vita-os/core";

import type { SqlExpression, SqlValue } from "../../platform/d1/statements";
import type { RequestScope } from "../../platform/request-scope";
import type { AreaRow } from "../areas/rows";
import type { ThreadRow } from "./rows";

import {
  isUniqueViolation,
  joinedColumns,
  prefixColumns,
  setClause,
  sqlExpression,
} from "../../platform/d1/statements";
import { AREA_COLUMNS, toAreaSummary } from "../areas/rows";
import { serializeUpNext, THREAD_COLUMNS, toThread } from "./rows";

/** What one Thread change writes: its patch and the Activity Log it earned. */
export type ThreadChange = {
  patch: ThreadPatch;
  logs: AutoActivityLogEntry[];
};

/** A create or rename lost its slug to another of the owner's Threads. */
export function isThreadSlugTaken(error: unknown): boolean {
  return isUniqueViolation(error, "threads.user_id, threads.slug");
}

/** Where each patchable field is stored, apart from Up Next's JSON. */
const PATCH_COLUMNS = {
  title: "title",
  slug: "slug",
  summary: "summary",
  areaId: "area_id",
  state: "state",
  nextMove: "next_move",
  followUp: "follow_up",
} as const satisfies Partial<Record<keyof ThreadPatch, string>>;

/**
 * The owner's Threads, one D1 round trip per function.
 *
 * Every statement is scoped by the owner, so a missing Thread and somebody
 * else's Thread read the same: `null`.
 */
export function threadStorage({ db, clock, actorId }: RequestScope) {
  return {
    async listOpen(): Promise<Thread[]> {
      const result = await db
        .prepare(
          `SELECT ${THREAD_COLUMNS}
           FROM threads
           WHERE user_id = ? AND state = 'open'
           ORDER BY sort_order ASC, id ASC`,
        )
        .bind(actorId)
        .all<ThreadRow>();

      return result.results.map(toThread);
    },

    /**
     * The Thread and the Area it is filed under, in one ownership-constrained
     * join. Both records are matched against the owner, so an inconsistent
     * cross-owner relationship cannot leak an Area.
     */
    async findDetail(slug: string): Promise<ThreadDetail | null> {
      const row = await db
        .prepare(
          `SELECT ${prefixColumns("t", THREAD_COLUMNS)},
                  ${prefixColumns("a", AREA_COLUMNS, "area__")}
           FROM threads t
           JOIN areas a ON a.id = t.area_id AND a.user_id = ?
           WHERE t.user_id = ? AND t.slug = ?
           LIMIT 1`,
        )
        .bind(actorId, actorId, slug)
        .first<ThreadRow & Record<string, unknown>>();
      if (row === null) return null;

      return {
        thread: toThread(row),
        area: toAreaSummary(joinedColumns(row, "area__") as unknown as AreaRow),
      };
    },

    async find(threadId: string): Promise<Thread | null> {
      const row = await db
        .prepare(
          `SELECT ${THREAD_COLUMNS}
           FROM threads
           WHERE user_id = ? AND id = ?
           LIMIT 1`,
        )
        .bind(actorId, threadId)
        .first<ThreadRow>();

      return row === null ? null : toThread(row);
    },

    async exists(threadId: string): Promise<boolean> {
      const row = await db
        .prepare("SELECT id FROM threads WHERE user_id = ? AND id = ? LIMIT 1")
        .bind(actorId, threadId)
        .first<{ id: string }>();

      return row !== null;
    },

    /**
     * The Area check, the order allocation, and the insert are one statement:
     * a Thread cannot land in somebody else's Area, and two Threads created at
     * once cannot claim the same position. `null` means the Area is missing or
     * belongs to somebody else; throws when the slug is taken.
     */
    async insert(thread: {
      title: string;
      slug: string;
      summary?: string;
      areaId: string;
    }): Promise<Thread | null> {
      const row = await db
        .prepare(
          `INSERT INTO threads (
             id, user_id, area_id, title, slug, summary, sort_order, state,
             created_at, revision
           )
           SELECT ?, ?, ?, ?, ?, ?,
                  (SELECT COALESCE(MAX(sort_order) + 1, 0)
                   FROM threads WHERE user_id = ?),
                  'open', ?, 0
           WHERE EXISTS (SELECT 1 FROM areas WHERE id = ? AND user_id = ?)
           RETURNING ${THREAD_COLUMNS}`,
        )
        .bind(
          clock.newId(),
          actorId,
          thread.areaId,
          thread.title,
          thread.slug,
          thread.summary ?? null,
          actorId,
          clock.now(),
          thread.areaId,
          actorId,
        )
        .first<ThreadRow>();

      return row === null ? null : toThread(row);
    },

    /**
     * One atomic Thread change: the patch, the revision bump, the denormalized
     * last-activity stamp, and every Activity Log entry the change earned.
     *
     * The update is conditional on the revision the change was decided against
     * — and on the Next Move, when the caller named one — and stamps a fresh
     * change token. Each entry is inserted only from the Thread row carrying
     * that token, so a lost race writes neither the patch nor a single orphan
     * entry. `null` means the race was lost; throws when a new slug is taken.
     */
    async writeChange(input: {
      threadId: string;
      expectedRevision: number;
      expectedNextMove?: string | null;
      change: ThreadChange;
    }): Promise<Thread | null> {
      const { patch, logs } = input.change;
      const changedAt = clock.now();
      const changeToken = clock.newId();
      const lastLog = logs.at(-1);

      const columns: Record<string, SqlValue | SqlExpression | undefined> = {};
      for (const [field, column] of Object.entries(PATCH_COLUMNS)) {
        if (Object.hasOwn(patch, field)) {
          columns[column] = patch[field as keyof typeof PATCH_COLUMNS] ?? null;
        }
      }
      if (Object.hasOwn(patch, "upNext")) {
        columns.up_next_json = serializeUpNext(patch.upNext);
      }
      if (lastLog !== undefined) {
        columns.last_activity_at = changedAt;
        columns.last_activity_content = lastLog.content;
      }
      columns.revision = sqlExpression("revision + 1");
      columns.last_change_token = changeToken;
      const set = setClause(columns);

      const nextMoveCondition =
        input.expectedNextMove === undefined ? "" : " AND next_move IS ?";
      // A destination may disappear after the decision read it. Guard it in
      // the write so the normal re-read reports the missing Area without a
      // foreign-key failure or any Activity Log entries.
      const areaCondition =
        patch.areaId === undefined
          ? ""
          : " AND EXISTS (SELECT 1 FROM areas WHERE id = ? AND user_id = ?)";
      const statements = [
        db
          .prepare(
            `UPDATE threads
             SET ${set.sql}
             WHERE user_id = ? AND id = ? AND revision = ?${nextMoveCondition}${areaCondition}
             RETURNING ${THREAD_COLUMNS}`,
          )
          .bind(
            ...set.binds,
            actorId,
            input.threadId,
            input.expectedRevision,
            ...(input.expectedNextMove === undefined
              ? []
              : [input.expectedNextMove]),
            ...(patch.areaId === undefined ? [] : [patch.areaId, actorId]),
          ),
        ...logs.map((log) =>
          db
            .prepare(
              `INSERT INTO activity_log_entries (
                 id, user_id, thread_id, type, content, previous_value,
                 new_value, created_at
               )
               SELECT ?, user_id, id, ?, ?, ?, ?, ?
               FROM threads
               WHERE id = ? AND user_id = ? AND last_change_token = ?`,
            )
            .bind(
              clock.newId(),
              log.type,
              log.content,
              log.previousValue ?? null,
              log.newValue ?? null,
              changedAt,
              input.threadId,
              actorId,
              changeToken,
            ),
        ),
      ];

      const [update, ...inserts] = await db.batch<ThreadRow>(statements);
      const written = update.results.at(0);
      if (written === undefined) return null;

      if (inserts.some((insert) => insert.meta.changes !== 1)) {
        throw new Error(
          "Thread change wrote an unexpected number of log entries",
        );
      }

      return toThread(written);
    },

    /**
     * Delete a Thread, the Activity Log it accumulated, and the Notes captured
     * inside it, in one batch.
     *
     * Both exist only as part of a Thread, so they go with it — left behind they
     * would be unreachable rows that still count against every owner-scoped
     * read. `false` means there was no such Thread.
     */
    async remove(threadId: string): Promise<boolean> {
      const [, , removal] = await db.batch([
        db
          .prepare(
            "DELETE FROM activity_log_entries WHERE user_id = ? AND thread_id = ?",
          )
          .bind(actorId, threadId),
        db
          .prepare(
            "DELETE FROM thread_notes WHERE user_id = ? AND thread_id = ?",
          )
          .bind(actorId, threadId),
        db
          .prepare("DELETE FROM threads WHERE user_id = ? AND id = ?")
          .bind(actorId, threadId),
      ]);

      return removal.meta.changes > 0;
    },
  };
}
