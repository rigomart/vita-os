import type { Thread, ThreadDetail } from "@vita-os/contracts";
import type { AutoActivityLogEntry, ThreadPatch } from "@vita-os/core";
import type { SQL } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import {
  and,
  asc,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  max,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { RequestScope } from "../../platform/request-scope";
import type { ThreadRow } from "./rows";

import {
  activityLogEntries,
  areas,
  threadNotes,
  threads,
} from "../../platform/d1/schema";
import { isUniqueViolation } from "../../platform/d1/statements";
import { AREA_FIELDS, toAreaSummary } from "../areas/rows";
import { threadNoteStorage } from "../thread-notes/storage";
import { serializeTasks, THREAD_FIELDS, toThread } from "./rows";

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
  guard?: SQL;
  stampActivity?: boolean;
};

/** A create or rename lost its slug to another of the owner's Threads. */
export function isThreadSlugTaken(error: unknown): boolean {
  return isUniqueViolation(error, "threads.user_id, threads.slug");
}

/**
 * The statements of one Thread change, not yet sent. A fresh token guards
 * every dependent write, so a lost revision race creates no orphan entries.
 */
function prepareThreadChange(
  { db, clock, actorId }: RequestScope,
  input: ThreadChangeInput,
  activityContent?: { content: null },
) {
  const database = drizzle(db);
  const { patch, logs } = input.change;
  const changedAt = clock.now();
  const changeToken = clock.newId();
  const lastLog = logs.at(-1);
  const columns: SQLiteUpdateSetSource<typeof threads> = {
    ...(Object.hasOwn(patch, "title")
      ? { title: patch.title ?? sql`NULL` }
      : {}),
    ...(Object.hasOwn(patch, "slug") ? { slug: patch.slug ?? sql`NULL` } : {}),
    ...(Object.hasOwn(patch, "summary")
      ? { summary: patch.summary ?? null }
      : {}),
    ...(Object.hasOwn(patch, "areaId")
      ? { area_id: patch.areaId ?? null }
      : {}),
    ...(Object.hasOwn(patch, "state")
      ? { state: patch.state ?? sql`NULL` }
      : {}),
    ...(Object.hasOwn(patch, "focusedTaskId")
      ? { focused_move_id: patch.focusedTaskId ?? null }
      : {}),
    ...(Object.hasOwn(patch, "tasks")
      ? { moves_json: serializeTasks(patch.tasks) }
      : {}),
    ...(lastLog !== undefined || input.stampActivity === true
      ? {
          last_activity_at: changedAt,
          last_activity_content:
            activityContent === undefined
              ? (lastLog?.content ?? null)
              : activityContent.content,
        }
      : {}),
    revision: sql`${threads.revision} + 1`,
    last_change_token: changeToken,
  };
  // Check the destination again in the write. It may disappear after the
  // operation reads it, and losing it must write no patch or Activity Log.
  const update = database
    .update(threads)
    .set(columns)
    .where(
      and(
        eq(threads.user_id, actorId),
        eq(threads.id, input.threadId),
        eq(threads.revision, input.expectedRevision),
        patch.areaId === undefined
          ? undefined
          : exists(
              database
                .select({ id: areas.id })
                .from(areas)
                .where(
                  and(eq(areas.id, patch.areaId), eq(areas.user_id, actorId)),
                ),
            ),
        input.guard,
      ),
    )
    .returning(THREAD_FIELDS);
  const inserts = logs.map((log) =>
    database.insert(activityLogEntries).select(
      database
        .select({
          id: sql<string>`${clock.newId()}`.as("id"),
          user_id: threads.user_id,
          thread_id: threads.id,
          type: sql<AutoActivityLogEntry["type"]>`${log.type}`.as("type"),
          content: sql<string>`${log.content}`.as("content"),
          previous_value: sql<string | null>`${log.previousValue ?? null}`.as(
            "previous_value",
          ),
          new_value: sql<string | null>`${log.newValue ?? null}`.as(
            "new_value",
          ),
          created_at: sql<number>`${changedAt}`.as("created_at"),
        })
        .from(threads)
        .where(
          and(
            eq(threads.id, input.threadId),
            eq(threads.user_id, actorId),
            eq(threads.last_change_token, changeToken),
          ),
        ),
    ),
  );

  return {
    update,
    inserts,
    changeToken,
    changedAt,
    settle(writtenRows: ThreadRow[], insertResults: D1Result[]): Thread | null {
      const written = writtenRows.at(0);
      if (written === undefined) return null;
      if (insertResults.some((insert) => insert.meta.changes !== 1)) {
        throw new Error(
          "Thread change wrote an unexpected number of log entries",
        );
      }
      return toThread(written);
    },
  };
}

/** Prepared queries for a workflow sharing this Thread change's atomic batch. */
export type PreparedThreadChange = ReturnType<typeof prepareThreadChange>;

/** The owner's Threads, one D1 round trip per function. */
export function threadStorage(scope: RequestScope) {
  const { db, clock, actorId } = scope;
  const database = drizzle(db);

  /** The Area check, order allocation and insert form one guarded statement. */
  function prepareInsert(thread: NewThread, guard?: SQL) {
    const threadId = clock.newId();
    const areaGuard =
      thread.areaId === undefined
        ? sql`TRUE`
        : exists(
            database
              .select({ id: areas.id })
              .from(areas)
              .where(
                and(eq(areas.id, thread.areaId), eq(areas.user_id, actorId)),
              ),
          );
    // SELECT without FROM keeps allocation and ownership in one statement.
    // Its values follow the complete schema column order.
    const statement = database
      .insert(threads)
      .select(sql`
      SELECT ${threadId}, ${actorId}, ${thread.areaId ?? null},
             ${thread.title}, ${thread.slug}, ${thread.summary ?? null},
             (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM ${threads}
              WHERE ${threads.user_id} = ${actorId}),
             'open', NULL, NULL, ${clock.now()}, 0, NULL, NULL, NULL
      WHERE ${and(areaGuard, guard)}
    `)
      .returning(THREAD_FIELDS);
    return { threadId, statement };
  }

  function prepareChange(
    input: ThreadChangeInput,
    activityContent?: { content: null },
  ) {
    return prepareThreadChange(scope, input, activityContent);
  }

  return {
    async listOpen(): Promise<Thread[]> {
      const rows = await database
        .select(THREAD_FIELDS)
        .from(threads)
        .where(and(eq(threads.user_id, actorId), eq(threads.state, "open")))
        .orderBy(asc(threads.sort_order), asc(threads.id));
      return rows.map(toThread);
    },

    /** Latest resolution wins; legacy Threads without a resolution entry come last. */
    async listResolved(): Promise<Thread[]> {
      const resolutions = database
        .select({
          thread_id: activityLogEntries.thread_id,
          resolved_at: max(activityLogEntries.created_at).as("resolved_at"),
        })
        .from(activityLogEntries)
        .where(
          and(
            eq(activityLogEntries.user_id, actorId),
            eq(activityLogEntries.type, "state_change"),
            eq(activityLogEntries.new_value, "resolved"),
          ),
        )
        .groupBy(activityLogEntries.thread_id)
        .as("resolutions");
      const rows = await database
        .select(THREAD_FIELDS)
        .from(threads)
        .leftJoin(resolutions, eq(resolutions.thread_id, threads.id))
        .where(and(eq(threads.user_id, actorId), eq(threads.state, "resolved")))
        .orderBy(desc(resolutions.resolved_at), asc(threads.id));
      return rows.map(toThread);
    },

    /** One ownership-constrained join prevents an inconsistent Area from leaking. */
    async findDetail(slug: string): Promise<ThreadDetail | null> {
      const row = await database
        .select({ thread: THREAD_FIELDS, area: AREA_FIELDS })
        .from(threads)
        .leftJoin(
          areas,
          and(eq(areas.id, threads.area_id), eq(areas.user_id, actorId)),
        )
        .where(
          and(
            eq(threads.user_id, actorId),
            eq(threads.slug, slug),
            or(isNull(threads.area_id), isNotNull(areas.id)),
          ),
        )
        .limit(1)
        .get();
      if (row === undefined) return null;
      return {
        thread: toThread(row.thread),
        ...(row.area === null ? {} : { area: toAreaSummary(row.area) }),
      };
    },

    async find(threadId: string): Promise<Thread | null> {
      const row = await database
        .select(THREAD_FIELDS)
        .from(threads)
        .where(and(eq(threads.user_id, actorId), eq(threads.id, threadId)))
        .limit(1)
        .get();
      return row === undefined ? null : toThread(row);
    },

    /** Revision is private to storage decisions, never part of a public Thread. */
    async findForChange(
      threadId: string,
    ): Promise<{ thread: Thread; revision: number } | null> {
      const row = await database
        .select(THREAD_FIELDS)
        .from(threads)
        .where(and(eq(threads.user_id, actorId), eq(threads.id, threadId)))
        .limit(1)
        .get();
      return row === undefined
        ? null
        : { thread: toThread(row), revision: row.revision };
    },

    async exists(threadId: string): Promise<boolean> {
      const row = await database
        .select({ id: threads.id })
        .from(threads)
        .where(and(eq(threads.user_id, actorId), eq(threads.id, threadId)))
        .limit(1)
        .get();
      return row !== undefined;
    },

    async insert(thread: NewThread): Promise<Thread | null> {
      const row = await prepareInsert(thread).statement.get();
      return row === undefined ? null : toThread(row);
    },

    prepareInsert,

    /** One atomic patch, revision bump, activity stamp, logs and optional Note. */
    async writeChange(
      input: ThreadChangeInput & {
        completionNote?: { id: string; body: string };
      },
    ): Promise<Thread | null> {
      const prepared = prepareChange(
        input,
        input.completionNote === undefined ? undefined : { content: null },
      );
      if (input.completionNote === undefined) {
        const [writtenRows, ...inserts] = await database.batch([
          prepared.update,
          ...prepared.inserts,
        ]);
        return prepared.settle(writtenRows, inserts);
      }
      try {
        const [writtenRows, ...inserts] = await database.batch([
          prepared.update,
          ...prepared.inserts,
          threadNoteStorage(scope).prepareInsert(
            input.threadId,
            input.completionNote.body,
            {
              id: input.completionNote.id,
              token: prepared.changeToken,
              at: prepared.changedAt,
            },
          ),
        ]);
        const written = prepared.settle(writtenRows, inserts.slice(0, -1));
        if (written !== null && inserts.at(-1)?.meta.changes !== 1) {
          throw new Error(
            "Task completion wrote an unexpected number of Thread Notes",
          );
        }
        return written;
      } catch (error) {
        // Reusing a client ID rolls back the complete batch, including Task and log.
        if (isUniqueViolation(error, "thread_notes.id")) return null;
        throw error;
      }
    },

    prepareChange: (input: ThreadChangeInput) => prepareChange(input),

    /** Delete the Thread and all of its owned records in one atomic batch. */
    async remove(threadId: string): Promise<boolean> {
      const [, , removal] = await database.batch([
        database
          .delete(activityLogEntries)
          .where(
            and(
              eq(activityLogEntries.user_id, actorId),
              eq(activityLogEntries.thread_id, threadId),
            ),
          ),
        database
          .delete(threadNotes)
          .where(
            and(
              eq(threadNotes.user_id, actorId),
              eq(threadNotes.thread_id, threadId),
            ),
          ),
        database
          .delete(threads)
          .where(and(eq(threads.user_id, actorId), eq(threads.id, threadId))),
      ]);
      return removal.meta.changes > 0;
    },
  };
}
