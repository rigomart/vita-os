import type { ActivityLogPage, Thread } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { createTestApp } from "./app";
import { call, createSession, expectError, succeed } from "./sessions";

/**
 * Moves, driven through the Worker the way the browser drives them: peers in
 * capture order, one optional Focused Move, and completion as the only change
 * the Activity Log records.
 */

const moveConflict = {
  status: 409,
  code: "conflict",
  message: "The Thread's Moves have changed.",
};

const resolvedRefusal = {
  status: 409,
  code: "conflict",
  message: "Cannot change the moves of a resolved thread",
};

async function createThread(session: Session): Promise<Thread> {
  return succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: "Book checkup" },
  });
}

function add(session: Session, thread: Thread, moveId: string, text: string) {
  return call(`/v1/threads/${thread._id}/moves`, {
    method: "POST",
    session,
    body: { moveId, text, expectedRevision: thread.revision },
  });
}

async function added(
  session: Session,
  thread: Thread,
  moveId: string,
  text: string,
): Promise<Thread> {
  const answer = await add(session, thread, moveId, text);
  expect(answer.status).toBe(200);
  return answer.body as Thread;
}

/** A Thread holding these Moves, captured in order. */
async function threadWith(session: Session, texts: string[]) {
  let thread = await createThread(session);
  for (const [index, text] of texts.entries()) {
    thread = await added(session, thread, `move-${index + 1}`, text);
  }
  return thread;
}

function complete(session: Session, thread: Thread, moveId: string) {
  return call(`/v1/threads/${thread._id}/moves/${moveId}/complete`, {
    method: "POST",
    session,
    body: { expectedRevision: thread.revision },
  });
}

function focus(session: Session, thread: Thread, moveId: string | null) {
  return call(`/v1/threads/${thread._id}/focus`, {
    method: "PUT",
    session,
    body: { moveId, expectedRevision: thread.revision },
  });
}

function remove(session: Session, thread: Thread, moveId: string) {
  return call(`/v1/threads/${thread._id}/moves/${moveId}`, {
    method: "DELETE",
    session,
    body: { expectedRevision: thread.revision },
  });
}

async function read(session: Session, thread: Thread): Promise<Thread> {
  const threads = await succeed<Thread[]>("/v1/threads", { session });
  const found = threads.find((candidate) => candidate._id === thread._id);
  if (!found) throw new Error("Thread is not open");
  return found;
}

async function activityOf(session: Session, thread: Thread) {
  const page = await succeed<ActivityLogPage>(
    `/v1/threads/${thread._id}/activity?limit=50`,
    { session },
  );
  return page.entries;
}

async function storedMoves(thread: Thread) {
  return env.DB.prepare(
    "SELECT moves_json, focused_move_id FROM threads WHERE id = ?",
  )
    .bind(thread._id)
    .first<{ moves_json: string | null; focused_move_id: string | null }>();
}

describe("capturing Moves", () => {
  it("keeps Moves in capture order, unfocused, and writes no Activity Log", async () => {
    const owner = await createSession("moves-capture");
    const thread = await threadWith(owner, ["  Call clinic ", "Book slot"]);

    expect(thread.moves).toEqual([
      { _id: "move-1", text: "Call clinic" },
      { _id: "move-2", text: "Book slot" },
    ]);
    expect(thread).not.toHaveProperty("focusedMoveId");
    expect(thread.revision).toBe(2);
    expect(await activityOf(owner, thread)).toEqual([]);
    expect(thread).not.toHaveProperty("lastActivityAt");
  });

  it("refuses a blank Move and writes nothing", async () => {
    const owner = await createSession("moves-blank");
    const thread = await createThread(owner);

    expectError(await add(owner, thread, "move-1", "   "), {
      status: 400,
      code: "validation",
      message: "Move cannot be empty",
    });
    expect(await read(owner, thread)).toEqual(thread);
  });

  it("edits a Move's text in place, silently", async () => {
    const owner = await createSession("moves-edit");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);

    const edited = await succeed<Thread>(
      `/v1/threads/${thread._id}/moves/move-1`,
      {
        method: "PATCH",
        session: owner,
        body: { text: " Call the clinic before nine ", expectedRevision: 2 },
      },
    );

    expect(edited.moves).toEqual([
      { _id: "move-1", text: "Call the clinic before nine" },
      { _id: "move-2", text: "Book slot" },
    ]);
    expect(await activityOf(owner, thread)).toEqual([]);
  });

  it("refuses an ID the Thread already holds", async () => {
    const owner = await createSession("moves-duplicate");
    const thread = await threadWith(owner, ["Call clinic"]);

    expectError(await add(owner, thread, "move-1", "Again"), moveConflict);
    expect((await read(owner, thread)).moves).toHaveLength(1);
  });

  it("refuses adding, editing, and focusing on a resolved Thread", async () => {
    const owner = await createSession("moves-resolved");
    const thread = await threadWith(owner, ["Call clinic"]);
    const resolved = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });

    expectError(await add(owner, resolved, "move-2", "More"), resolvedRefusal);
    expectError(
      await call(`/v1/threads/${thread._id}/moves/move-1`, {
        method: "PATCH",
        session: owner,
        body: { text: "Edited", expectedRevision: resolved.revision },
      }),
      resolvedRefusal,
    );
    expectError(await focus(owner, resolved, null), resolvedRefusal);
  });
});

describe("focus", () => {
  it("focuses one Move, replaces an earlier focus, and unfocuses, all silently", async () => {
    const owner = await createSession("moves-focus");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);

    const first = await focus(owner, thread, "move-1");
    expect(first.status).toBe(200);
    expect((first.body as Thread).focusedMoveId).toBe("move-1");

    const second = await focus(owner, first.body as Thread, "move-2");
    expect((second.body as Thread).focusedMoveId).toBe("move-2");

    const cleared = await focus(owner, second.body as Thread, null);
    expect(cleared.body).not.toHaveProperty("focusedMoveId");
    // Focus never reorders the list.
    expect((cleared.body as Thread).moves?.map((move) => move._id)).toEqual([
      "move-1",
      "move-2",
    ]);
    expect(await activityOf(owner, thread)).toEqual([]);
  });

  it("refuses to focus a Move the Thread does not hold", async () => {
    const owner = await createSession("moves-focus-missing");
    const thread = await threadWith(owner, ["Call clinic"]);

    expectError(await focus(owner, thread, "move-9"), moveConflict);
    expect(await read(owner, thread)).toEqual(thread);
  });
});

describe("completing and removing", () => {
  it("completes a Move that is not focused, logging it and stamping last activity", async () => {
    const owner = await createSession("moves-complete-unfocused");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const focused = (await focus(owner, thread, "move-1")).body as Thread;

    const answer = await complete(owner, focused, "move-2");

    expect(answer.status).toBe(200);
    const completed = answer.body as Thread;
    expect(completed.moves).toEqual([{ _id: "move-1", text: "Call clinic" }]);
    expect(completed.focusedMoveId).toBe("move-1");
    const [entry] = await activityOf(owner, thread);
    expect(entry).toMatchObject({
      type: "move_completed",
      content: 'Completed "Book slot"',
      previousValue: "Book slot",
    });
    expect(entry).not.toHaveProperty("newValue");
    expect(completed.lastActivityContent).toBe('Completed "Book slot"');
    expect(completed.lastActivityAt).toBe(entry?.createdAt);
  });

  it("leaves the Thread unfocused after completing the Focused Move: nothing is promoted", async () => {
    const owner = await createSession("moves-complete-focused");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const focused = (await focus(owner, thread, "move-1")).body as Thread;

    const completed = (await complete(owner, focused, "move-1")).body as Thread;

    expect(completed.moves).toEqual([{ _id: "move-2", text: "Book slot" }]);
    expect(completed).not.toHaveProperty("focusedMoveId");
  });

  it("leaves the Thread open once every Move is complete", async () => {
    const owner = await createSession("moves-complete-all");
    const thread = await threadWith(owner, ["Call clinic"]);

    const completed = (await complete(owner, thread, "move-1")).body as Thread;

    expect(completed.state).toBe("open");
    expect(completed).not.toHaveProperty("moves");
    expect(await storedMoves(thread)).toEqual({
      moves_json: null,
      focused_move_id: null,
    });
    expect((await read(owner, thread))._id).toBe(thread._id);
  });

  it("removes a Move without a trace, and removing the Focused Move unfocuses", async () => {
    const owner = await createSession("moves-remove");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const focused = (await focus(owner, thread, "move-2")).body as Thread;

    const answer = await remove(owner, focused, "move-2");

    expect(answer.status).toBe(200);
    expect((answer.body as Thread).moves).toEqual([
      { _id: "move-1", text: "Call clinic" },
    ]);
    expect(answer.body).not.toHaveProperty("focusedMoveId");
    expect(await activityOf(owner, thread)).toEqual([]);
  });
});

describe("conflicts", () => {
  it("refuses a command made against a stale revision, writing nothing", async () => {
    const owner = await createSession("moves-stale");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const stale = { ...thread, revision: thread.revision - 1 };

    expectError(await complete(owner, stale, "move-1"), moveConflict);
    expectError(await add(owner, stale, "move-3", "Pay bill"), moveConflict);
    expect(await read(owner, thread)).toEqual(thread);
    expect(await activityOf(owner, thread)).toEqual([]);
  });

  it("refuses to complete a Move another device already completed", async () => {
    const owner = await createSession("moves-gone");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const completed = (await complete(owner, thread, "move-1")).body as Thread;

    expectError(await complete(owner, completed, "move-1"), moveConflict);
    expect(await activityOf(owner, thread)).toHaveLength(1);
  });

  it("records exactly one of two competing completions", async () => {
    const owner = await createSession("moves-competing");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);

    const answers = await Promise.all([
      complete(owner, thread, "move-1"),
      complete(owner, thread, "move-1"),
    ]);

    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
    expect((await read(owner, thread)).moves).toEqual([
      { _id: "move-2", text: "Book slot" },
    ]);
    expect(await activityOf(owner, thread)).toHaveLength(1);
  });

  it("answers not found for a Thread that is not there", async () => {
    const owner = await createSession("moves-missing-thread");

    expectError(
      await call("/v1/threads/missing-thread/moves/move-1/complete", {
        method: "POST",
        session: owner,
        body: { expectedRevision: 0 },
      }),
      { status: 404, code: "not_found", message: "Thread not found." },
    );
  });
});

describe("rollback", () => {
  it("writes neither the completion nor its entry when the entry cannot be written", async () => {
    const owner = await createSession("moves-rollback");
    const thread = await threadWith(owner, ["Call clinic"]);
    const duplicateId = `duplicate-activity-${crypto.randomUUID()}`;
    await env.DB.prepare(
      "INSERT INTO activity_log_entries (id, user_id, thread_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        duplicateId,
        owner.actorId,
        thread._id,
        "state_change",
        "Existing entry",
        1_600_000_000_000,
      )
      .run();
    const before = await read(owner, thread);
    const app = createTestApp({
      // The change token and the entry ID come from the same injected mint,
      // so the insert hits the existing entry's primary key and the whole batch
      // must roll back.
      createScope: (authenticated) => ({
        ...authenticated,
        clock: { now: () => 1_800_000_000_000, newId: () => duplicateId },
      }),
    });

    const response = await app.request(
      `http://api.test/v1/threads/${thread._id}/moves/move-1/complete`,
      {
        method: "POST",
        headers: { cookie: owner.cookie, "content-type": "application/json" },
        body: JSON.stringify({ expectedRevision: thread.revision }),
      },
      env,
    );

    expect(response.status).toBe(500);
    expect(await read(owner, thread)).toEqual(before);
    expect(await activityOf(owner, thread)).toHaveLength(1);
  });
});

describe("request shape", () => {
  it.each([
    ["POST", "moves", { moveId: "m", text: "Call" }],
    ["POST", "moves", { moveId: "", text: "Call", expectedRevision: 0 }],
    ["POST", "moves", { moveId: "m", text: 1, expectedRevision: 0 }],
    ["POST", "moves", { moveId: "m", text: "a", expectedRevision: -1 }],
    ["POST", "moves", { moveId: "m", text: "a", expectedRevision: 0, x: 1 }],
    ["PATCH", "moves/move-1", { text: "Call" }],
    ["POST", "moves/move-1/complete", { expectedRevision: 1.5 }],
    ["DELETE", "moves/move-1", {}],
    ["PUT", "focus", { expectedRevision: 0 }],
    ["PUT", "focus", { moveId: 3, expectedRevision: 0 }],
  ] as const)("refuses %s %s with %j", async (method, route, body) => {
    const owner = await createSession("moves-shape");
    const thread = await threadWith(owner, ["Call clinic"]);

    expectError(
      await call(`/v1/threads/${thread._id}/${route}`, {
        method,
        session: owner,
        body,
      }),
      { status: 400, code: "validation", message: "Invalid Move change." },
    );
    expect(await read(owner, thread)).toEqual(thread);
  });
});
