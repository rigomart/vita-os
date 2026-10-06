import type { ActivityLogPage, Thread } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

/**
 * A Task's optional date (ADR 0032), driven through the Worker: set, change
 * and clear by Task ID with the caller's revision, no Activity Log entry, and
 * the same refusals as every other Task command.
 */

const taskConflict = {
  status: 409,
  code: "conflict",
  message: "The Thread's Tasks have changed.",
};

const day = new Date(2026, 9, 12).getTime();
const afternoon = new Date(2026, 9, 12, 15, 30).getTime();

async function threadWith(session: Session, texts: string[]) {
  let thread = await succeed<Thread>("/v1/threads", {
    method: "POST",
    session,
    body: { title: "Book checkup" },
  });
  for (const [index, text] of texts.entries()) {
    thread = await succeed<Thread>(`/v1/threads/${thread._id}/tasks`, {
      method: "POST",
      session,
      body: {
        taskId: `task-${index + 1}`,
        text,
        expectedRevision: thread.revision,
      },
    });
  }
  return thread;
}

function setDate(
  session: Session,
  thread: Thread,
  taskId: string,
  date: number | null,
) {
  return call(`/v1/threads/${thread._id}/tasks/${taskId}/date`, {
    method: "PUT",
    session,
    body: { date, expectedRevision: thread.revision },
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

describe("a Task's date", () => {
  it("is set, changed and cleared on one Task, with no Activity Log entry", async () => {
    const owner = await createSession("task-dates-cycle");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);

    const set = (await setDate(owner, thread, "task-2", afternoon))
      .body as Thread;
    expect(set.tasks).toEqual([
      { _id: "task-1", text: "Call clinic" },
      { _id: "task-2", text: "Book slot", date: afternoon },
    ]);
    expect(set.revision).toBe(thread.revision + 1);

    const changed = (await setDate(owner, set, "task-2", day)).body as Thread;
    expect(changed.tasks?.[1]).toEqual({
      _id: "task-2",
      text: "Book slot",
      date: day,
    });

    const cleared = (await setDate(owner, changed, "task-2", null))
      .body as Thread;
    expect(cleared.tasks).toEqual(thread.tasks);
    expect(cleared.tasks?.[1]).not.toHaveProperty("date");

    expect(await read(owner, cleared)).toEqual(cleared);
    expect(await activityOf(owner, thread)).toEqual([]);
    expect(cleared).not.toHaveProperty("lastActivityAt");
  });

  it("is stored inside the Task JSON beside its ID and text", async () => {
    const owner = await createSession("task-dates-storage");
    const thread = await threadWith(owner, ["Call clinic"]);
    await setDate(owner, thread, "task-1", afternoon);

    expect(
      await env.DB.prepare("SELECT moves_json FROM threads WHERE id = ?")
        .bind(thread._id)
        .first(),
    ).toEqual({
      moves_json: JSON.stringify([
        { id: "task-1", text: "Call clinic", date: afternoon },
      ]),
    });
  });

  it("changes nothing, and writes nothing, when the date is unchanged", async () => {
    const owner = await createSession("task-dates-noop");
    const thread = await threadWith(owner, ["Call clinic"]);
    const dated = (await setDate(owner, thread, "task-1", day)).body as Thread;

    const again = await setDate(owner, dated, "task-1", day);
    expect(again.status).toBe(200);
    expect((again.body as Thread).revision).toBe(dated.revision);

    const clearUndated = await setDate(owner, thread, "task-1", null);
    expectError(clearUndated, taskConflict);
  });

  it("can be put on a Task that is focused, and focus stays", async () => {
    const owner = await createSession("task-dates-focused");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const focused = (
      await call(`/v1/threads/${thread._id}/focus`, {
        method: "PUT",
        session: owner,
        body: { taskId: "task-1", expectedRevision: thread.revision },
      })
    ).body as Thread;

    const dated = (await setDate(owner, focused, "task-1", day)).body as Thread;
    expect(dated.focusedTaskId).toBe("task-1");
    expect(dated.tasks?.[0]?.date).toBe(day);
  });

  it("is refused against a stale revision or a missing Task, writing nothing", async () => {
    const owner = await createSession("task-dates-refused");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const stale = { ...thread, revision: thread.revision - 1 };

    expectError(await setDate(owner, stale, "task-1", day), taskConflict);
    expectError(await setDate(owner, thread, "task-9", day), taskConflict);
    expect(await read(owner, thread)).toEqual(thread);
  });

  it("is refused on a Thread that is not there, or is somebody else's", async () => {
    const owner = await createSession("task-dates-owner");
    const stranger = await createSession("task-dates-stranger");
    const thread = await threadWith(owner, ["Call clinic"]);

    expectError(await setDate(stranger, thread, "task-1", day), {
      status: 404,
      code: "not_found",
      message: "Thread not found.",
    });
    expect(await read(owner, thread)).toEqual(thread);
    expectError(
      await call("/v1/threads/missing/tasks/task-1/date", {
        method: "PUT",
        session: owner,
        body: { date: day, expectedRevision: 0 },
      }),
      { status: 404, code: "not_found", message: "Thread not found." },
    );
  });

  it("is refused on a resolved Thread", async () => {
    const owner = await createSession("task-dates-resolved");
    const thread = await threadWith(owner, ["Call clinic"]);
    const resolved = await succeed<Thread>(`/v1/threads/${thread._id}`, {
      method: "PATCH",
      session: owner,
      body: { state: "resolved" },
    });

    expectError(await setDate(owner, resolved, "task-1", day), {
      status: 409,
      code: "conflict",
      message: "Cannot change the tasks of a resolved thread",
    });
  });

  it.each([
    [{ expectedRevision: 0 }],
    [{ date: "tomorrow", expectedRevision: 0 }],
    [{ date: 1.5, expectedRevision: 0 }],
    [{ date: 1, expectedRevision: -1 }],
    [{ date: 1, expectedRevision: 0, extra: true }],
  ])("refuses the request shape %j", async (body) => {
    const owner = await createSession("task-dates-shape");
    const thread = await threadWith(owner, ["Call clinic"]);

    expectError(
      await call(`/v1/threads/${thread._id}/tasks/task-1/date`, {
        method: "PUT",
        session: owner,
        body,
      }),
      { status: 400, code: "validation", message: "Invalid Task change." },
    );
    expect(await read(owner, thread)).toEqual(thread);
  });

  it("is not offered on the former /moves routes", async () => {
    const owner = await createSession("task-dates-moves");
    const thread = await threadWith(owner, ["Call clinic"]);

    const route = await call(`/v1/threads/${thread._id}/moves/task-1/date`, {
      method: "PUT",
      session: owner,
      body: { date: day, expectedRevision: thread.revision },
    });
    expect(route.status).toBe(404);

    const add = await call(`/v1/threads/${thread._id}/moves`, {
      method: "POST",
      session: owner,
      body: {
        moveId: "move-2",
        text: "Dated",
        date: day,
        expectedRevision: thread.revision,
      },
    });
    expect(add.status).toBe(400);
    expect(await read(owner, thread)).toEqual(thread);
  });
});

describe("adding a Task already dated", () => {
  it("adds it in one action, dated, without an Activity Log entry", async () => {
    const owner = await createSession("task-dates-add");
    const thread = await threadWith(owner, ["Call clinic"]);

    const added = await succeed<Thread>(`/v1/threads/${thread._id}/tasks`, {
      method: "POST",
      session: owner,
      body: {
        taskId: "task-2",
        text: "Follow up",
        date: afternoon,
        expectedRevision: thread.revision,
      },
    });

    expect(added.tasks?.at(-1)).toEqual({
      _id: "task-2",
      text: "Follow up",
      date: afternoon,
    });
    expect(await activityOf(owner, thread)).toEqual([]);
  });
});
