import type { Thread, ThreadDetail } from "@vita-os/contracts";
import type { AutoActivityLogEntry, ThreadPatch } from "@vita-os/core";

import type {
  SqlCondition,
  SqlExpression,
  SqlValue,
} from "../../platform/d1/statements";
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
import { threadNoteStorage } from "../thread-notes/storage";
import { serializeTasks, THREAD_COLUMNS, toThread } from "./rows";

/** What one Thread change writes: its patch and the Activity Log it earned. */
export type ThreadChange = {
  patch: ThreadPatch;
  logs: AutoActivityLogEntry[];
};

export type NewThread = {
  title: string;
  slug: string;
  summary?: string;
  areaId?: string;
};

export type ThreadChangeInput = {
  threadId: string;
  expectedRevision: number;
  change: ThreadChange;
  guard?: SqlCondition;
  stampActivity?: boolean;
};

/**
 * One Thread change, prepared but not yet sent: the statements `writeChange`
 * batches, for a workflow that must write them in the same batch as its own.
 */
export interface PreparedThreadChange {
  statements: D1PreparedStatement[];
  /**
   * Stamped on the Thread only when the change is written, so a later
   * statement in the same batch can make itself conditional on the change.
   */
  changeToken: string;
  changedAt: number;
  /** The Thread as written, from these statements' results; `null` if the race was lost. */
  settle(results: D1Result<ThreadRow>[]): Thread | null;
}

/** A create or rename lost its slug to another of the owner's Threads. */
export function isThreadSlugTaken(error: unknown): boolean {
  return isUniqueViolation(error, "threads.user_id, threads.slug");
}

/** Where each patchable field is stored, apart from the Tasks' JSON. */
const PATCH_COLUMNS = {
  title: "title",
  slug: "slug",
  summary: "summary",
  areaId: "area_id",
  state: "state",
  focusedTaskId: "focused_move_id",
} as const satisfies Partial<Record<keyof ThreadPatch, string>>;

/**
 * The owner's Threads, one D1 round trip per function.
 *
 * Every statement is scoped by the owner, so a missing Thread and somebody
 * else's Thread read the same: `null`.
 */
export function threadStorage({ db, clock, actorId }: RequestScope) {
  /**
   * The insert of a new Thread, not yet sent. `guard` adds a composing
   * workflow's own condition, so the Thread is created only when it holds.
   */
  function prepareInsert(
    thread: NewThread,
    guard?: SqlCondition,
  ): { threadId: string; statement: D1PreparedStatement } {
    const threadId = clock.newId();
    const statement = db
      .prepare(
        `INSERT INTO threads (
           id, user_id, area_id, title, slug, summary, sort_order, state,
           created_at, revision
         )
         SELECT ?, ?, ?, ?, ?, ?,
                (SELECT COALESCE(MAX(sort_order) + 1, 0)
                 FROM threads WHERE user_id = ?),
                'open', ?, 0
         WHERE (? IS NULL
                OR EXISTS (SELECT 1 FROM areas WHERE id = ? AND user_id = ?))${
                  guard === undefined ? "" : ` AND ${guard.sql}`
                }
         RETURNING ${THREAD_COLUMNS}`,
      )
      .bind(
        threadId,
        actorId,
        thread.areaId ?? null,
        thread.title,
        thread.slug,
        thread.summary ?? null,
        actorId,
        clock.now(),
        thread.areaId ?? null,
        thread.areaId ?? null,
        actorId,
        ...(guard?.binds ?? []),
      );

    return { threadId, statement };
  }

  /**
   * The statements of one Thread change, not yet sent.
   *
   * The update is conditional on the revision the change was decided against
   * and stamps a fresh change token. Each entry is inserted only from the
   * Thread row carrying that token, so a lost race writes neither the patch
   * nor a single orphan entry. `guard` adds a composing workflow's own
   * condition to the update; `stampActivity` stamps the last activity even
   * when the change earns no entry, with nothing to quote.
   */
  function prepareChange(
    input: ThreadChangeInput,
    activityContent?: { content: null },
  ): PreparedThreadChange {
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
    if (Object.hasOwn(patch, "tasks")) {
      columns.moves_json = serializeTasks(patch.tasks);
    }
    if (lastLog !== undefined || input.stampActivity === true) {
      columns.last_activity_at = changedAt;
      columns.last_activity_content =
        activityContent === undefined
          ? (lastLog?.content ?? null)
          : activityContent.content;
    }
    columns.revision = sqlExpression("revision + 1");
    columns.last_change_token = changeToken;
    const set = setClause(columns);

    // A destination may disappear after the decision read it. Guard it in
    // the write so the normal re-read reports the missing Area without a
    // foreign-key failure or any Activity Log entries. Removing the label
    // has no destination to guard.
    const areaCondition =
      patch.areaId === undefined
        ? ""
        : " AND EXISTS (SELECT 1 FROM areas WHERE id = ? AND user_id = ?)";
    const guardCondition =
      input.guard === undefined ? "" : ` AND ${input.guard.sql}`;
    const statements = [
      db
        .prepare(
          `UPDATE threads
           SET ${set.sql}
           WHERE user_id = ? AND id = ? AND revision = ?${areaCondition}${guardCondition}
           RETURNING ${THREAD_COLUMNS}`,
        )
        .bind(
          ...set.binds,
          actorId,
          input.threadId,
          input.expectedRevision,
          ...(patch.areaId === undefined ? [] : [patch.areaId, actorId]),
          ...(input.guard?.binds ?? []),
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

    return {
      statements,
      changeToken,
      changedAt,
      settle([update, ...inserts]) {
        const written = update?.results.at(0);
        if (written === undefined) return null;

        if (inserts.some((insert) => insert.meta.changes !== 1)) {
          throw new Error(
            "Thread change wrote an unexpected number of log entries",
          );
        }

        return toThread(written);
      },
    };
  }

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

    /** Latest resolution wins; legacy Threads without a resolution entry come last. */
    async listResolved(): Promise<Thread[]> {
      const result = await db
        .prepare(
          `SELECT ${prefixColumns("t", THREAD_COLUMNS)}
           FROM threads t
           LEFT JOIN (
             SELECT thread_id, MAX(created_at) AS resolved_at
             FROM activity_log_entries
             WHERE user_id = ? AND type = 'state_change' AND new_value = 'resolved'
             GROUP BY thread_id
           ) resolutions ON resolutions.thread_id = t.id
           WHERE t.user_id = ? AND t.state = 'resolved'
           ORDER BY resolutions.resolved_at DESC, t.id ASC`,
        )
        .bind(actorId, actorId)
        .all<ThreadRow>();

      return result.results.map(toThread);
    },

    /**
     * The Thread and its Area label, in one ownership-constrained join. Both
     * records are matched against the owner, so an inconsistent cross-owner
     * relationship cannot leak an Area; an unlabeled Thread reads without one.
     */
    async findDetail(slug: string): Promise<ThreadDetail | null> {
      const row = await db
        .prepare(
          `SELECT ${prefixColumns("t", THREAD_COLUMNS)},
                  ${prefixColumns("a", AREA_COLUMNS, "area__")}
           FROM threads t
           LEFT JOIN areas a ON a.id = t.area_id AND a.user_id = ?
           WHERE t.user_id = ? AND t.slug = ?
             AND (t.area_id IS NULL OR a.id IS NOT NULL)
           LIMIT 1`,
        )
        .bind(actorId, actorId, slug)
        .first<ThreadRow & Record<string, unknown>>();
      if (row === null) return null;

      const area = joinedColumns(row, "area__") as unknown as AreaRow;
      return {
        thread: toThread(row),
        ...(area.id === null ? {} : { area: toAreaSummary(area) }),
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
     * a Thread cannot be labeled with somebody else's Area, and two Threads
     * created at once cannot claim the same position. `null` means the Area is
     * missing or belongs to somebody else; throws when the slug is taken.
     */
    async insert(thread: NewThread): Promise<Thread | null> {
      const row = await prepareInsert(thread).statement.first<ThreadRow>();
      return row === null ? null : toThread(row);
    },

    prepareInsert,

    /**
     * One atomic Thread change: the patch, the revision bump, the denormalized
     * last-activity stamp, and every Activity Log entry the change earned.
     * `null` means the race was lost; throws when a new slug is taken.
     */
    async writeChange(
      input: ThreadChangeInput & {
        /** Already validated, with the ID minted by the caller. */
        completionNote?: { id: string; body: string };
      },
    ): Promise<Thread | null> {
      const prepared = prepareChange(
        input,
        input.completionNote === undefined ? undefined : { content: null },
      );
      const statements = [...prepared.statements];
      if (input.completionNote !== undefined) {
        statements.push(
          threadNoteStorage({ db, clock, actorId }).prepareInsert(
            input.threadId,
            input.completionNote.body,
            {
              id: input.completionNote.id,
              token: prepared.changeToken,
              at: prepared.changedAt,
            },
          ),
        );
      }
      // D1 rolls back the entire batch on any statement failure. The capture
      // depends on the revision-checked Thread write's fresh token, exactly
      // as the log entries do, so a lost race writes none of them.
      let results: D1Result<ThreadRow>[];
      try {
        results = await db.batch<ThreadRow>(statements);
      } catch (error) {
        // A reused client ID rolls back the whole batch, including the Task and log.
        if (
          input.completionNote !== undefined &&
          isUniqueViolation(error, "thread_notes.id")
        )
          return null;
        throw error;
      }
      const written = prepared.settle(
        results.slice(0, prepared.statements.length),
      );
      // This post-batch assertion cannot fail after a successful Thread update:
      // the Note insert depends on the same token as the log inserts checked by settle.
      if (
        written !== null &&
        input.completionNote !== undefined &&
        results.at(-1)?.meta.changes !== 1
      ) {
        throw new Error(
          "Task completion wrote an unexpected number of Thread Notes",
        );
      }
      return written;
    },

    prepareChange: (input: ThreadChangeInput) => prepareChange(input),

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
