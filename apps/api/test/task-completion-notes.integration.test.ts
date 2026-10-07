import type { ActivityLogPage, Thread, ThreadNote } from "@vita-os/contracts";

import { newRecordId } from "@vita-os/core";
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { threadStorage } from "../src/features/threads/storage";
import { createTestApp } from "./app";
import { call, createSession, expectError, succeed } from "./sessions";

const now = Date.parse("2026-10-10T20:00Z");
const date = Date.parse("2026-10-06T15:30Z");

async function setup(repeats = false) {
  const session = await createSession("completion-note");
  const created = await succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: "Check" },
  });
  let thread = await succeed<Thread>(`/v1/threads/${created._id}/tasks`, {
    method: "POST",
    session,
    body: {
      taskId: "a",
      text: "Call clinic",
      date,
    },
  });
  if (repeats)
    thread = await succeed<Thread>(`/v1/threads/${thread._id}/tasks/a/repeat`, {
      method: "PUT",
      session,
      body: {
        repeat: { kind: "days", every: 1 },
        timeZone: "UTC",
      },
    });
  return { session, thread };
}

async function snapshot(session: Session, thread: Thread) {
  const detail = await succeed<{ thread: Thread }>(
    `/v1/threads/${thread.slug}`,
    { session },
  );
  const notes = await succeed<ThreadNote[]>(`/v1/threads/${thread._id}/notes`, {
    session,
  });
  const log = await succeed<ActivityLogPage>(
    `/v1/threads/${thread._id}/activity?limit=50`,
    { session },
  );
  return { thread: detail.thread, notes, log: log.entries };
}

async function complete(
  session: Session,
  thread: Thread,
  body: object,
  taskId = "a",
  beforeBatch?: () => Promise<void>,
) {
  const minted: string[] = [];
  const app = createTestApp({
    createScope: (authenticated) => ({
      ...authenticated,
      db: new Proxy(authenticated.db, {
        get(target, key) {
          if (key === "batch")
            return async (statements: D1PreparedStatement[]) => {
              await beforeBatch?.();
              return target.batch(statements);
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }),
      clock: {
        now: () => now,
        newId: () => {
          const id = crypto.randomUUID();
          minted.push(id);
          return id;
        },
      },
    }),
  });
  const response = await app.request(
    `/v1/threads/${thread._id}/tasks/${taskId}/complete`,
    {
      method: "POST",
      headers: { cookie: session.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        expectedOccurrence:
          thread.tasks?.find((task) => task._id === taskId)?.date ?? null,
        ...body,
      }),
    },
    env,
  );
  return { status: response.status, body: await response.json(), minted };
}

describe("completing a Task with a Thread Note", () => {
  it("guards Note capture when the revision changes between the read and batch", async () => {
    const { session, thread } = await setup();
    const before = await snapshot(session, thread);
    let batches = 0;
    const answer = await complete(
      session,
      thread,
      { note: { id: newRecordId(), body: "Called" } },
      "a",
      async () => {
        batches++;
        await env.DB.prepare(
          "UPDATE threads SET revision = revision + 1 WHERE id = ?",
        )
          .bind(thread._id)
          .run();
      },
    );
    expect(batches).toBe(3);
    expectError(answer, { status: 409, code: "conflict" });
    expect(await snapshot(session, thread)).toEqual({
      ...before,
      thread: before.thread,
    });
  });

  it("refuses a reused Note ID at the current revision without writing anything", async () => {
    const { session, thread } = await setup(true);
    const id = newRecordId();
    expect(
      (
        await complete(session, thread, {
          note: { id, body: "First" },
          timeZone: "UTC",
        })
      ).status,
    ).toBe(200);
    const before = await snapshot(session, thread);
    expectError(
      await complete(session, before.thread, {
        note: { id, body: "Second" },
        timeZone: "UTC",
      }),
      { status: 409, code: "conflict" },
    );
    expect(await snapshot(session, thread)).toEqual(before);
  });

  it("does not clear the activity quote when prepareChange captures no Note", async () => {
    const { session, thread } = await setup();
    const storage = threadStorage({
      db: env.DB,
      actorId: session.actorId,
      clock: { now: () => now, newId: () => newRecordId() },
    });
    const input = {
      threadId: thread._id,
      expectedRevision: (await storage.findForChange(thread._id))!.revision,
      completionNote: { id: newRecordId(), body: "Uncaptured" },
      change: {
        patch: {},
        logs: [
          {
            type: "move_completed" as const,
            content: "Completed",
            previousValue: "Call clinic",
          },
        ],
      },
    };
    const prepared = storage.prepareChange(input);
    await env.DB.batch(prepared.statements);
    const after = await snapshot(session, thread);
    expect(after.thread.lastActivityContent).toBe("Completed");
    expect(after.notes).toEqual([]);
  });

  it.each([false, true])(
    "captures only once when two completions compete (repeat=%s)",
    async (repeats) => {
      const { session, thread } = await setup(repeats);
      const answers = await Promise.all([
        complete(session, thread, {
          note: { id: newRecordId(), body: "First" },
          timeZone: "UTC",
        }),
        complete(session, thread, {
          note: { id: newRecordId(), body: "Second" },
          timeZone: "UTC",
        }),
      ]);
      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
      const after = await snapshot(session, thread);
      expect(after.notes).toHaveLength(1);
      expect(after.log).toHaveLength(1);

      const winner = answers.find((answer) => answer.status === 200);
      expect(after.thread).toEqual(winner!.body);
    },
  );
  it.each([false, true])(
    "captures one client-minted Note and one unchanged log entry (repeat=%s)",
    async (repeats) => {
      const { session, thread } = await setup(repeats);
      const noteId = newRecordId();
      const answer = await complete(session, thread, {
        note: { id: noteId, body: "  Called **clinic**\nOpens at nine  " },
        timeZone: "UTC",
      });
      expect(answer.status).toBe(200);
      const after = await snapshot(session, thread);
      expect(after.notes).toHaveLength(1);
      expect(after.notes[0]).toEqual({
        _id: noteId,
        body: "Called **clinic**\nOpens at nine",
        state: "open",
        createdAt: now,
        updatedAt: now,
      });
      expect(answer.minted).not.toContain(noteId);
      expect(after.thread.lastActivityAt).toBe(now);
      expect(after.thread).not.toHaveProperty("lastActivityContent");

      if (repeats)
        expect(after.thread.tasks).toEqual([
          { ...thread.tasks![0], date: Date.parse("2026-10-10T15:30Z") },
        ]);
      else expect(after.thread.tasks).toBeUndefined();
      expect(after.log).toHaveLength(1);
      expect(after.log[0]).toMatchObject({
        type: "move_completed",
        content: 'Completed "Call clinic"',
        createdAt: now,
      });
      expect(answer.body).toEqual(after.thread);
      // Replaying the original command is refused by its occurrence, including for repeats.
      expectError(
        await complete(session, thread, {
          note: { id: noteId, body: "Called **clinic**\nOpens at nine" },
          timeZone: "UTC",
        }),
        { status: 409, code: "conflict" },
      );
      expect(await snapshot(session, thread)).toEqual(after);
    },
  );

  it.each([
    [
      "changed occurrence",
      { expectedOccurrence: null, note: { id: newRecordId(), body: "Called" } },
      "a",
      409,
    ],
    [
      "missing Task",
      { note: { id: newRecordId(), body: "Called" } },
      "absent",
      409,
    ],
    [
      "invalid zone",
      { note: { id: newRecordId(), body: "Called" }, timeZone: "Mars/Olympus" },
      "a",
      400,
    ],
    ["missing zone", { note: { id: newRecordId(), body: "Called" } }, "a", 400],
    [
      "blank body",
      { note: { id: newRecordId(), body: " \n\t " }, timeZone: "UTC" },
      "a",
      400,
    ],
    [
      "non-string body",
      { note: { id: newRecordId(), body: 5 }, timeZone: "UTC" },
      "a",
      400,
    ],
    ["missing body", { note: {}, timeZone: "UTC" }, "a", 400],
    [
      "empty ID",
      { note: { id: "", body: "Called" }, timeZone: "UTC" },
      "a",
      400,
    ],
    [
      "long ID",
      { note: { id: "x".repeat(65), body: "Called" }, timeZone: "UTC" },
      "a",
      400,
    ],
    ["missing ID", { note: { body: "Called" }, timeZone: "UTC" }, "a", 400],
    ["null note", { note: null, timeZone: "UTC" }, "a", 400],
  ])(
    "leaves all records unchanged on %s",
    async (_label, body, taskId, status) => {
      const { session, thread } = await setup(true);
      const before = await snapshot(session, thread);
      expectError(await complete(session, thread, body, taskId), {
        status,
        code: status === 409 ? "conflict" : "validation",
      });
      expect(await snapshot(session, thread)).toEqual(before);
    },
  );

  it("rolls back a storage error in the Note insert after the Thread and log writes", async () => {
    const { session, thread } = await setup();
    const before = await snapshot(session, thread);
    await env.DB.prepare(
      `CREATE TRIGGER fail_completion_note BEFORE INSERT ON thread_notes BEGIN SELECT RAISE(ABORT, 'injected note failure'); END`,
    ).run();
    try {
      expectError(
        await complete(session, thread, {
          note: { id: newRecordId(), body: "Called" },
        }),
        { status: 500, code: "unexpected" },
      );
      expect(await snapshot(session, thread)).toEqual(before);
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_completion_note").run();
    }
  });

  it("keeps completion without a Note unchanged", async () => {
    const { session, thread } = await setup();
    expect((await complete(session, thread, {})).status).toBe(200);
    const after = await snapshot(session, thread);
    expect(after.notes).toEqual([]);
    expect(after.thread.tasks).toBeUndefined();
    expect(after.thread.lastActivityContent).toBe('Completed "Call clinic"');
    expect(after.log).toHaveLength(1);
  });

  it("refuses another owner's Thread without changing it", async () => {
    const { session, thread } = await setup();
    const stranger = await createSession("completion-note-stranger");
    const before = await snapshot(session, thread);
    expectError(
      await call(`/v1/threads/${thread._id}/tasks/a/complete`, {
        method: "POST",
        session: stranger,
        body: {
          expectedOccurrence: date,
          note: { id: newRecordId(), body: "Mine" },
        },
      }),
      { status: 404, code: "not_found" },
    );
    expect(await snapshot(session, thread)).toEqual(before);
  });
});
