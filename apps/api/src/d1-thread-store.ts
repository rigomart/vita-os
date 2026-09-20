import type {
  ActivityLogPage,
  CommandAcknowledgement,
  CompleteNextMoveOutput,
  CreateThreadInput,
  PageRequest,
  Thread,
  ThreadDetail,
  ThreadId,
  UpdateThreadInput,
} from "@vita-os/contracts";
import type { AutoActivityLogEntry, ThreadPatch } from "@vita-os/core";

import { commandAcknowledged } from "@vita-os/contracts";
import {
  clearedToAbsent,
  decideNextMoveCompletion,
  decideThreadUpdate,
  generateSlug,
  requireNonBlankText,
  requireOpenForUpNext,
  requireUpNextMoves,
  storedUpNext,
} from "@vita-os/core";

import type { WorkerEnv } from "./env";
import type { ActivityRow, AreaRow, ThreadRow } from "./rows";
import type { Actored, StoreClock, StoreResult, ThreadStore } from "./store";

import { activityCursor, pageBoundary, toPage } from "./page-cursor";
import {
  ACTIVITY_COLUMNS,
  AREA_COLUMNS,
  parseUpNext,
  serializeUpNext,
  THREAD_COLUMNS,
  toActivityLogEntry,
  toAreaSummary,
  toThread,
} from "./rows";
import { conflicted, found, missing, notFound } from "./store";

/**
 * How many times a Thread change re-reads and re-decides after losing a
 * revision race.
 *
 * Convex ran each mutation as a serialized transaction, so an ordinary edit
 * never failed because somebody else wrote first. A compare-and-swap here would
 * turn that into a user-visible conflict, so a lost race is retried from the
 * fresh Thread instead. Only a caller that supplied its own expected revision —
 * Next Move completion — is told about the conflict, because for that caller a
 * retry could complete a different move.
 */
const CHANGE_ATTEMPTS = 3;

/** How many times a create or rename re-mints a colliding slug. */
const SLUG_ATTEMPTS = 3;

function isUniqueSlugViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed: threads\.user_id, threads\.slug/.test(
      error.message,
    )
  );
}

type ThreadChange = {
  patch: ThreadPatch;
  logs: AutoActivityLogEntry[];
};

export class D1ThreadStore implements ThreadStore {
  constructor(
    private readonly database: WorkerEnv["DB"],
    private readonly clock: StoreClock,
  ) {}

  async listOpenThreads(input: Actored): Promise<Thread[]> {
    const result = await this.database
      .prepare(
        `SELECT ${THREAD_COLUMNS}
         FROM threads
         WHERE user_id = ? AND state = 'open'
         ORDER BY sort_order ASC, id ASC`,
      )
      .bind(input.actorId)
      .all<ThreadRow>();

    return result.results.map(toThread);
  }

  /**
   * The Thread and the Area it is filed under, in one ownership-constrained
   * join. Both records are matched against the actor, so an inconsistent
   * cross-owner relationship cannot leak an Area.
   */
  async getThreadDetail(
    input: Actored<{ slug: string }>,
  ): Promise<StoreResult<ThreadDetail>> {
    const row = await this.database
      .prepare(
        `SELECT ${prefixColumns("t", THREAD_COLUMNS)},
                ${prefixColumns("a", AREA_COLUMNS, "area__")}
         FROM threads t
         JOIN areas a ON a.id = t.area_id AND a.user_id = ?
         WHERE t.user_id = ? AND t.slug = ?
         LIMIT 1`,
      )
      .bind(input.actorId, input.actorId, input.slug)
      .first<ThreadRow & Record<string, unknown>>();
    if (row === null) return notFound;

    return found({
      thread: toThread(row),
      area: toAreaSummary(joinedColumns(row, "area__") as unknown as AreaRow),
    });
  }

  async createThread(
    input: Actored<CreateThreadInput>,
  ): Promise<StoreResult<Thread>> {
    const title = requireNonBlankText(input.title, "Thread title");
    const createdAt = this.clock.now();

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      try {
        // The Area check, the order allocation, and the insert are one
        // statement: a Thread cannot land in somebody else's Area, and two
        // Threads created at once cannot claim the same position.
        const row = await this.database
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
            this.clock.newId(),
            input.actorId,
            input.areaId,
            title,
            generateSlug(title),
            input.summary ?? null,
            input.actorId,
            createdAt,
            input.areaId,
            input.actorId,
          )
          .first<ThreadRow>();
        // No row means the Area is missing or belongs to somebody else.
        if (row === null) return missing("area");

        return found(toThread(row));
      } catch (error) {
        if (!isUniqueSlugViolation(error)) throw error;
      }
    }

    return conflicted;
  }

  /**
   * One Thread edit: title, Summary, Area, Next Move, Follow-up, or lifecycle.
   * The Activity Log the change earns is written with it or not at all.
   */
  async updateThread(
    input: Actored<UpdateThreadInput>,
  ): Promise<StoreResult<Thread>> {
    const { threadId, resolutionNote, actorId, ...requested } = input;
    const title =
      requested.title === undefined
        ? undefined
        : requireNonBlankText(requested.title, "Thread title");

    return this.changeThread({ actorId, threadId }, async (thread) => {
      const patch: ThreadPatch = clearedToAbsent({
        ...requested,
        ...(title === undefined ? {} : { title }),
      });
      // A retitled Thread gets a new slug; the old one stops resolving.
      const rename =
        title !== undefined && title !== thread.title
          ? { slug: generateSlug(title) }
          : {};

      // Naming both ends of a move is what lets the Activity Log say where the
      // Thread came from. An Area that is not the actor's stops the move here.
      let areaNames: { from: string; to: string } | undefined;
      if (patch.areaId !== undefined && patch.areaId !== thread.areaId) {
        const destination = await this.readArea(actorId, patch.areaId);
        if (destination === null) return missing("area");

        const origin = await this.readArea(actorId, thread.areaId);
        if (origin !== null) {
          areaNames = { from: origin.name, to: destination.name };
        }
      }

      return found(
        decideThreadUpdate({
          thread,
          patch: { ...patch, ...rename },
          ...(resolutionNote === undefined ? {} : { resolutionNote }),
          ...(areaNames === undefined ? {} : { areaNames }),
        }),
      );
    });
  }

  /**
   * Rewrite the Up Next line — adding, editing, reordering and removing all
   * arrive as the new list, in order.
   *
   * Editing Up Next is silent: no Activity Log entry is written. The one
   * exception is the invariant — a list handed to a Thread with an empty Next
   * Move slot promotes its front move, and a Next Move always logs.
   */
  async replaceUpNext(
    input: Actored<{ threadId: ThreadId; moves: string[] }>,
  ): Promise<StoreResult<Thread>> {
    const moves = requireUpNextMoves(input.moves);

    return this.changeThread(input, async (thread) => {
      requireOpenForUpNext(thread);

      return found(
        decideThreadUpdate({
          thread,
          patch: { upNext: storedUpNext(moves) },
        }),
      );
    });
  }

  /**
   * Complete the Next Move, and — when Up Next holds moves — hand the slot
   * straight to the front one.
   *
   * The caller supplies the Next Move it read and the revision it read it at, so
   * a repeated request cannot complete a promoted move whose text happens to
   * match the one already completed.
   */
  async completeNextMove(
    input: Actored<{
      threadId: ThreadId;
      expectedNextMove: string | null;
      expectedRevision: number;
    }>,
  ): Promise<StoreResult<CompleteNextMoveOutput>> {
    const thread = await this.readThread(input.actorId, input.threadId);
    if (thread === null) return notFound;

    if (
      thread.next_move !== input.expectedNextMove ||
      thread.revision !== input.expectedRevision
    ) {
      return conflicted;
    }

    const decision = decideNextMoveCompletion({
      ...(thread.next_move === null ? {} : { nextMove: thread.next_move }),
      ...(thread.up_next_json === null
        ? {}
        : { upNext: parseUpNext(thread.up_next_json) }),
    });
    if (decision.status === "unchanged") return found({ status: "unchanged" });

    const written = await this.writeThreadChange({
      actorId: input.actorId,
      threadId: input.threadId,
      expectedRevision: input.expectedRevision,
      expectedNextMove: input.expectedNextMove,
      change: { patch: decision.patch, logs: [decision.activity] },
    });
    if (written === null) return conflicted;

    return found({ status: "completed" });
  }

  /**
   * Delete a Thread, the Activity Log it accumulated, and the Notes captured
   * inside it.
   *
   * Both exist only as part of a Thread, so they go with it — left behind they
   * would be unreachable rows that still count against every owner-scoped read.
   */
  async removeThread(
    input: Actored<{ threadId: ThreadId }>,
  ): Promise<StoreResult<CommandAcknowledgement>> {
    const [, , removal] = await this.database.batch([
      this.database
        .prepare(
          "DELETE FROM activity_log_entries WHERE user_id = ? AND thread_id = ?",
        )
        .bind(input.actorId, input.threadId),
      this.database
        .prepare("DELETE FROM thread_notes WHERE user_id = ? AND thread_id = ?")
        .bind(input.actorId, input.threadId),
      this.database
        .prepare("DELETE FROM threads WHERE user_id = ? AND id = ?")
        .bind(input.actorId, input.threadId),
    ]);

    if (removal.meta.changes === 0) return notFound;

    return found(commandAcknowledged);
  }

  async getThreadActivityPage(
    input: Actored<{ threadId: ThreadId } & PageRequest>,
  ): Promise<StoreResult<ActivityLogPage>> {
    const owned = await this.database
      .prepare("SELECT id FROM threads WHERE user_id = ? AND id = ? LIMIT 1")
      .bind(input.actorId, input.threadId)
      .first<{ id: string }>();
    if (owned === null) return notFound;

    const cursor =
      input.cursor === undefined
        ? undefined
        : activityCursor.decode(input.cursor);
    const boundary = pageBoundary("created_at", cursor);
    const result = await this.database
      .prepare(
        `SELECT ${ACTIVITY_COLUMNS}
         FROM activity_log_entries
         WHERE user_id = ? AND thread_id = ?${boundary.sql}
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .bind(input.actorId, input.threadId, ...boundary.binds, input.limit + 1)
      .all<ActivityRow>();

    return found(
      toPage(result.results, input.limit, {
        toEntry: toActivityLogEntry,
        cursorFor: (entry) => ({ at: entry.createdAt, id: entry._id }),
        codec: activityCursor,
      }),
    );
  }

  private async readThread(
    actorId: string,
    threadId: string,
  ): Promise<ThreadRow | null> {
    return this.database
      .prepare(
        `SELECT ${THREAD_COLUMNS}
         FROM threads
         WHERE user_id = ? AND id = ?
         LIMIT 1`,
      )
      .bind(actorId, threadId)
      .first<ThreadRow>();
  }

  private async readArea(
    actorId: string,
    areaId: string,
  ): Promise<AreaRow | null> {
    return this.database
      .prepare(
        `SELECT ${AREA_COLUMNS} FROM areas WHERE user_id = ? AND id = ? LIMIT 1`,
      )
      .bind(actorId, areaId)
      .first<AreaRow>();
  }

  /**
   * Read the Thread, let a rule decide the change, and write it atomically.
   *
   * The write is conditional on the revision the decision was made against, so a
   * Thread that changed underneath is decided again from its new state rather
   * than overwritten with a stale conclusion.
   */
  private async changeThread(
    input: { actorId: string; threadId: string },
    decide: (thread: Thread) => Promise<StoreResult<ThreadChange>>,
  ): Promise<StoreResult<Thread>> {
    for (let attempt = 0; attempt < CHANGE_ATTEMPTS; attempt += 1) {
      const row = await this.readThread(input.actorId, input.threadId);
      if (row === null) return notFound;

      const decision = await decide(toThread(row));
      if (decision.status !== "ok") return decision;

      if (
        Object.keys(decision.value.patch).length === 0 &&
        decision.value.logs.length === 0
      ) {
        return found(toThread(row));
      }

      try {
        const written = await this.writeThreadChange({
          actorId: input.actorId,
          threadId: input.threadId,
          expectedRevision: row.revision,
          change: decision.value,
        });
        if (written !== null) return found(toThread(written));
      } catch (error) {
        if (!isUniqueSlugViolation(error)) throw error;
      }
    }

    return conflicted;
  }

  /**
   * One atomic Thread change: the patch, the revision bump, the denormalized
   * last-activity stamp, and every Activity Log entry the change earned.
   *
   * The update stamps a fresh change token and each entry is inserted only from
   * the Thread row carrying that token, so a lost revision race writes neither
   * the patch nor a single orphan entry. `null` means the race was lost.
   */
  private async writeThreadChange(input: {
    actorId: string;
    threadId: string;
    expectedRevision: number;
    expectedNextMove?: string | null;
    change: ThreadChange;
  }): Promise<ThreadRow | null> {
    const { patch, logs } = input.change;
    const changedAt = this.clock.now();
    const changeToken = this.clock.newId();
    const lastLog = logs.at(-1);

    const assignments: string[] = [];
    const binds: (string | number | null)[] = [];
    const assign = (column: string, value: string | number | null) => {
      assignments.push(`${column} = ?`);
      binds.push(value);
    };

    if (Object.hasOwn(patch, "title")) assign("title", patch.title ?? null);
    if (Object.hasOwn(patch, "slug")) assign("slug", patch.slug ?? null);
    if (Object.hasOwn(patch, "summary"))
      assign("summary", patch.summary ?? null);
    if (Object.hasOwn(patch, "areaId")) assign("area_id", patch.areaId ?? null);
    if (Object.hasOwn(patch, "state")) assign("state", patch.state ?? null);
    if (Object.hasOwn(patch, "nextMove")) {
      assign("next_move", patch.nextMove ?? null);
    }
    if (Object.hasOwn(patch, "upNext")) {
      assign("up_next_json", serializeUpNext(patch.upNext));
    }
    if (Object.hasOwn(patch, "followUp")) {
      assign("follow_up", patch.followUp ?? null);
    }
    if (lastLog !== undefined) {
      assign("last_activity_at", changedAt);
      assign("last_activity_content", lastLog.content);
    }
    assignments.push("revision = revision + 1");
    assign("last_change_token", changeToken);

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
      this.database
        .prepare(
          `UPDATE threads
           SET ${assignments.join(", ")}
           WHERE user_id = ? AND id = ? AND revision = ?${nextMoveCondition}${areaCondition}
           RETURNING ${THREAD_COLUMNS}`,
        )
        .bind(
          ...binds,
          input.actorId,
          input.threadId,
          input.expectedRevision,
          ...(input.expectedNextMove === undefined
            ? []
            : [input.expectedNextMove]),
          ...(patch.areaId === undefined ? [] : [patch.areaId, input.actorId]),
        ),
      ...logs.map((log) =>
        this.database
          .prepare(
            `INSERT INTO activity_log_entries (
               id, user_id, thread_id, type, content, previous_value, new_value,
               created_at
             )
             SELECT ?, user_id, id, ?, ?, ?, ?, ?
             FROM threads
             WHERE id = ? AND user_id = ? AND last_change_token = ?`,
          )
          .bind(
            this.clock.newId(),
            log.type,
            log.content,
            log.previousValue ?? null,
            log.newValue ?? null,
            changedAt,
            input.threadId,
            input.actorId,
            changeToken,
          ),
      ),
    ];

    const [update, ...inserts] =
      await this.database.batch<ThreadRow>(statements);
    const written = update.results.at(0);
    if (written === undefined) return null;

    if (inserts.some((insert) => insert.meta.changes !== 1)) {
      throw new Error(
        "Thread change wrote an unexpected number of log entries",
      );
    }

    return written;
  }
}

function prefixColumns(table: string, columns: string, alias = ""): string {
  return columns
    .split(",")
    .map((column) => column.trim())
    .map((column) =>
      alias === ""
        ? `${table}.${column}`
        : `${table}.${column} AS ${alias}${column}`,
    )
    .join(", ");
}

/**
 * The joined Area's own columns, taken back out of the joined row.
 *
 * A join has to alias one side's columns — both tables have an `id` — so the Area
 * arrives prefixed and is read back out under its own names.
 */
function joinedColumns(
  row: Record<string, unknown>,
  alias: string,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith(alias)) columns[key.slice(alias.length)] = value;
  }
  return columns;
}
