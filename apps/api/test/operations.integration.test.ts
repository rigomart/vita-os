import type {
  OperationResult,
  TaskId,
  ThreadNoteId,
  Thread,
} from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperationFailure } from "../src/platform/failures";
import type { RequestScope } from "../src/platform/request-scope";

import { createNote } from "../src/features/notes/operations";
import * as threads from "../src/features/threads/operations";
import { threadStorage } from "../src/features/threads/storage";
import { toRefusal } from "../src/platform/http/errors";
import { RequestContext } from "../src/platform/request-scope";

describe("Effect operations", () => {
  it("defers a write until execution and uses the executing request's owner", async () => {
    const firstActor = crypto.randomUUID();
    const secondActor = crypto.randomUUID();
    const create = createNote({ body: "Lazy note" });
    const before = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notes WHERE body = ?",
    )
      .bind("Lazy note")
      .first<{ count: number }>();
    expect(before?.count).toBe(0);

    const first = await Effect.runPromise(
      create.pipe(
        Effect.provideService(RequestContext, {
          db: env.DB,
          actorId: firstActor,
          clock: { now: () => 100, newId: () => crypto.randomUUID() },
        }),
      ),
    );
    const second = await Effect.runPromise(
      create.pipe(
        Effect.provideService(RequestContext, {
          db: env.DB,
          actorId: secondActor,
          clock: { now: () => 200, newId: () => crypto.randomUUID() },
        }),
      ),
    );
    expect(first.createdAt).toBe(100);
    expect(second.createdAt).toBe(200);
    expect(second._id).not.toBe(first._id);
    const rows = await env.DB.prepare(
      "SELECT user_id FROM notes WHERE body = ? ORDER BY created_at",
    )
      .bind("Lazy note")
      .all<{ user_id: string }>();
    expect(rows.results.map((row) => row.user_id)).toEqual([
      firstActor,
      secondActor,
    ]);
  });

  it("puts a domain refusal in the typed failure channel without writing", async () => {
    const actorId = crypto.randomUUID();
    const outcome = await Effect.runPromise(
      createNote({ body: "   " }).pipe(
        Effect.provideService(RequestContext, {
          db: env.DB,
          actorId,
          clock: { now: () => 100, newId: () => crypto.randomUUID() },
        }),
        Effect.match({
          onSuccess: () => null,
          onFailure: (failure) => ({
            tag: failure._tag,
            error: toRefusal(failure).error,
          }),
        }),
      ),
    );
    expect(outcome).toEqual({
      tag: "InvalidInput",
      error: {
        code: "validation",
        message: "Note body cannot be empty",
        retryable: false,
      },
    });
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notes WHERE user_id = ?",
    )
      .bind(actorId)
      .first<{ count: number }>();
    expect(row?.count).toBe(0);
  });
});

function run<T>(
  scope: RequestScope,
  operation: Effect.Effect<T, OperationFailure, RequestContext>,
): Promise<OperationResult<T>> {
  return Effect.runPromise(
    operation.pipe(
      Effect.provideService(RequestContext, scope),
      Effect.match({
        onSuccess: (value): OperationResult<T> => ({ ok: true, value }),
        onFailure: (failure): OperationResult<T> => ({
          ok: false,
          error: toRefusal(failure).error,
        }),
      }),
    ),
  );
}
function value<T>(result: OperationResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
async function tasksScope(repeats = false) {
  const scope: RequestScope = {
    db: env.DB,
    actorId: crypto.randomUUID(),
    clock: {
      now: () => Date.parse("2026-10-10T20:00Z"),
      newId: () => crypto.randomUUID(),
    },
  };
  let thread = value(
    await run(scope, threads.createThread({ title: "Current state" })),
  );
  for (const taskId of ["a", "b"])
    thread = value(
      await run(
        scope,
        threads.addTask({
          threadId: thread._id,
          taskId: taskId as TaskId,
          text: taskId,
          ...(repeats ? { date: Date.parse("2026-10-06T15:30Z") } : {}),
        }),
      ),
    );
  if (repeats)
    thread = value(
      await run(
        scope,
        threads.setTaskRepeat({
          threadId: thread._id,
          taskId: "a" as TaskId,
          repeat: { kind: "days", every: 1 },
          timeZone: "UTC",
        }),
      ),
    );
  return { scope, thread };
}
async function stored(scope: RequestScope, thread: Thread) {
  return env.DB.prepare(`SELECT moves_json, revision, last_activity_at, last_activity_content,
    (SELECT COUNT(*) FROM thread_notes WHERE thread_id = threads.id) AS notes,
    (SELECT COUNT(*) FROM activity_log_entries WHERE thread_id = threads.id) AS logs
    FROM threads WHERE id = ? AND user_id = ?`)
    .bind(thread._id, scope.actorId)
    .first();
}
afterEach(() => vi.restoreAllMocks());

describe("current-state Task commands", () => {
  it("applies a Task edit after an unrelated Thread edit", async () => {
    const { scope, thread } = await tasksScope();
    value(
      await run(
        scope,
        threads.updateThread({ threadId: thread._id, summary: "New summary" }),
      ),
    );
    const edited = value(
      await run(
        scope,
        threads.editTask({
          threadId: thread._id,
          taskId: "a" as TaskId,
          text: "Edited",
        }),
      ),
    );
    expect(edited.summary).toBe("New summary");
    expect(edited.tasks?.[0]?.text).toBe("Edited");
    expect(edited).not.toHaveProperty("revision");
  });

  it("preserves simultaneous edits to different Tasks after a storage race", async () => {
    const { scope, thread } = await tasksScope();
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      value(
        await run(
          scope,
          threads.editTask({
            threadId: thread._id,
            taskId: "b" as TaskId,
            text: "Second device",
          }),
        ),
      );
      return batch(statements);
    });
    value(
      await run(
        scope,
        threads.editTask({
          threadId: thread._id,
          taskId: "a" as TaskId,
          text: "First device",
        }),
      ),
    );
    const after = await threadStorage(scope).find(thread._id);
    expect(after?.tasks).toEqual([
      { _id: "a", text: "First device" },
      { _id: "b", text: "Second device" },
    ]);
  });

  it("rechecks the captured occurrence when Complete loses a race to Skip", async () => {
    const { scope, thread } = await tasksScope(true);
    const expectedOccurrence = thread.tasks![0]!.date!;
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      value(
        await run(
          scope,
          threads.skipTask({
            threadId: thread._id,
            taskId: "a" as TaskId,
            timeZone: "UTC",
            expectedOccurrence,
          }),
        ),
      );
      return batch(statements);
    });
    const answer = await run(
      scope,
      threads.completeTask({
        threadId: thread._id,
        taskId: "a" as TaskId,
        timeZone: "UTC",
        expectedOccurrence,
        note: {
          id: crypto.randomUUID() as ThreadNoteId,
          body: "Should not land",
        },
      }),
    );
    expect(answer).toMatchObject({ ok: false, error: { code: "conflict" } });
    const after = await threadStorage(scope).find(thread._id);
    expect(after?.tasks?.[0]?.date).toBe(Date.parse("2026-10-10T15:30Z"));
    expect(await stored(scope, thread)).toMatchObject({ notes: 0, logs: 0 });
  });

  it("a lost completion response followed by retry adds no Note or log and advances once", async () => {
    const { scope, thread } = await tasksScope(true);
    const input = {
      threadId: thread._id,
      taskId: "a" as TaskId,
      timeZone: "UTC",
      expectedOccurrence: thread.tasks![0]!.date!,
      note: { id: crypto.randomUUID() as ThreadNoteId, body: "Called" },
    };
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
      await batch(statements);
      throw new Error("Response lost after commit");
    });
    expect(await run(scope, threads.completeTask(input))).toMatchObject({
      ok: false,
      error: { code: "unexpected" },
    });
    const landed = await stored(scope, thread);
    expect(landed).toMatchObject({ notes: 1, logs: 1 });
    expect(await run(scope, threads.completeTask(input))).toMatchObject({
      ok: false,
      error: { code: "conflict" },
    });
    expect(await stored(scope, thread)).toEqual(landed);
  });

  it("rolls back Tasks, Note, log and activity stamp when Note insertion fails", async () => {
    const { scope, thread } = await tasksScope(true);
    const before = await stored(scope, thread);
    await env.DB.prepare(
      "CREATE TRIGGER fail_current_completion BEFORE INSERT ON thread_notes BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
    ).run();
    try {
      const answer = await run(
        scope,
        threads.completeTask({
          threadId: thread._id,
          taskId: "a" as TaskId,
          timeZone: "UTC",
          expectedOccurrence: thread.tasks![0]!.date!,
          note: { id: crypto.randomUUID() as ThreadNoteId, body: "Called" },
        }),
      );
      expect(answer).toMatchObject({
        ok: false,
        error: { code: "unexpected" },
      });
      expect(await stored(scope, thread)).toEqual(before);
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_current_completion").run();
    }
  });
});
