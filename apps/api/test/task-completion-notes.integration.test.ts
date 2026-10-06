import type { ActivityLogPage, Thread, ThreadNote } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

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
      expectedRevision: created.revision,
    },
  });
  if (repeats)
    thread = await succeed<Thread>(`/v1/threads/${thread._id}/tasks/a/repeat`, {
      method: "PUT",
      session,
      body: {
        repeat: { kind: "days", every: 1 },
        timeZone: "UTC",
        expectedRevision: thread.revision,
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
) {
  const minted: string[] = [];
  const app = createTestApp({
    createScope: (authenticated) => ({
      ...authenticated,
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
      body: JSON.stringify({ expectedRevision: thread.revision, ...body }),
    },
    env,
  );
  return { status: response.status, body: await response.json(), minted };
}

describe("completing a Task with a Thread Note", () => {
  it.each([false, true])(
    "captures only once when two completions compete (repeat=%s)",
    async (repeats) => {
      const { session, thread } = await setup(repeats);
      const answers = await Promise.all([
        complete(session, thread, { note: { body: "First" }, timeZone: "UTC" }),
        complete(session, thread, {
          note: { body: "Second" },
          timeZone: "UTC",
        }),
      ]);
      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
      const after = await snapshot(session, thread);
      expect(after.notes).toHaveLength(1);
      expect(after.log).toHaveLength(1);
      expect(after.thread.revision).toBe(thread.revision + 1);
      const winner = answers.find((answer) => answer.status === 200);
      expect(after.thread).toEqual(winner!.body);
    },
  );
  it.each([false, true])(
    "captures one server-minted Note and one unchanged log entry (repeat=%s)",
    async (repeats) => {
      const { session, thread } = await setup(repeats);
      const answer = await complete(session, thread, {
        note: { body: "  Called **clinic**\nOpens at nine  " },
        timeZone: "UTC",
      });
      expect(answer.status).toBe(200);
      const after = await snapshot(session, thread);
      expect(after.notes).toHaveLength(1);
      expect(after.notes[0]).toEqual({
        _id: expect.any(String),
        body: "Called **clinic**\nOpens at nine",
        state: "open",
        createdAt: now,
        updatedAt: now,
      });
      expect(answer.minted).toContain(after.notes[0]!._id);
      expect(after.thread.lastActivityAt).toBe(now);
      expect(after.thread).not.toHaveProperty("lastActivityContent");
      expect(after.thread.revision).toBe(thread.revision + 1);
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
      // Server-minted IDs follow normal Thread Note capture. Replaying the
      // original command is refused by its revision, including for repeats.
      expectError(
        await complete(session, thread, {
          note: { body: "Called **clinic**\nOpens at nine" },
          timeZone: "UTC",
        }),
        { status: 409, code: "conflict" },
      );
      expect(await snapshot(session, thread)).toEqual(after);
    },
  );

  it.each([
    [
      "stale revision",
      { expectedRevision: 0, note: { body: "Called" } },
      "a",
      409,
    ],
    ["missing Task", { note: { body: "Called" } }, "absent", 409],
    [
      "invalid zone",
      { note: { body: "Called" }, timeZone: "Mars/Olympus" },
      "a",
      400,
    ],
    ["missing zone", { note: { body: "Called" } }, "a", 400],
    ["blank body", { note: { body: " \n\t " }, timeZone: "UTC" }, "a", 400],
    ["non-string body", { note: { body: 5 }, timeZone: "UTC" }, "a", 400],
    ["missing body", { note: {}, timeZone: "UTC" }, "a", 400],
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
        await complete(session, thread, { note: { body: "Called" } }),
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
        body: { expectedRevision: thread.revision, note: { body: "Mine" } },
      }),
      { status: 404, code: "not_found" },
    );
    expect(await snapshot(session, thread)).toEqual(before);
  });
});
