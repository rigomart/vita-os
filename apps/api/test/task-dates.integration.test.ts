import type { ActivityLogPage, Thread } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

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
    body: { date },
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

    const clearUndated = await setDate(owner, thread, "task-1", null);
    expect(clearUndated.status).toBe(200);
    expect((clearUndated.body as Thread).tasks?.[0]).not.toHaveProperty("date");
  });

  it("can be put on a Task that is focused, and focus stays", async () => {
    const owner = await createSession("task-dates-focused");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);
    const focused = (
      await call(`/v1/threads/${thread._id}/focus`, {
        method: "PUT",
        session: owner,
        body: { taskId: "task-1" },
      })
    ).body as Thread;

    const dated = (await setDate(owner, focused, "task-1", day)).body as Thread;
    expect(dated.focusedTaskId).toBe("task-1");
    expect(dated.tasks?.[0]?.date).toBe(day);
  });

  it("is refused for a missing Task, writing nothing", async () => {
    const owner = await createSession("task-dates-refused");
    const thread = await threadWith(owner, ["Call clinic", "Book slot"]);

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
        body: { date: day },
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
    [{}],
    [{ date: "tomorrow" }],
    [{ date: 1.5 }],
    [{ date: 1, expectedRevision: 0 }],
    [{ date: 1, extra: true }],
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

  it("is bounded to 1970 through 9999, at the boundary", async () => {
    const owner = await createSession("task-dates-range");
    const thread = await threadWith(owner, ["Call clinic"]);
    const last = 253_402_300_799_999;

    const first = (await setDate(owner, thread, "task-1", 0)).body as Thread;
    expect(first.tasks?.[0]?.date).toBe(0);
    const edge = (await setDate(owner, first, "task-1", last)).body as Thread;
    expect(edge.tasks?.[0]?.date).toBe(last);

    for (const bad of [-1, last + 1, Number.MAX_SAFE_INTEGER]) {
      expectError(await setDate(owner, edge, "task-1", bad), {
        status: 400,
        code: "validation",
        message: "Invalid Task change.",
      });
    }
    expectError(
      await call(`/v1/threads/${thread._id}/tasks`, {
        method: "POST",
        session: owner,
        body: {
          taskId: "task-2",
          text: "Too far",
          date: last + 1,
        },
      }),
      { status: 400, code: "validation", message: "Invalid Task change." },
    );
    expect(await read(owner, edge)).toEqual(edge);
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

describe("a Note's Follow-up date range", () => {
  const last = 253_402_300_799_999;

  it("holds a Note's date to the same range as a Task's", async () => {
    const owner = await createSession("note-date-range");
    const created = await call("/v1/notes", {
      method: "POST",
      session: owner,
      body: { body: "Edge", followUp: last },
    });
    expect(created.status).toBe(201);
    const note = created.body as { _id: string };

    for (const bad of [-1, last + 1]) {
      expect(
        (
          await call("/v1/notes", {
            method: "POST",
            session: owner,
            body: { body: "Bad", followUp: bad },
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await call(`/v1/notes/${note._id}/follow-up`, {
            method: "PATCH",
            session: owner,
            body: { followUp: bad },
          })
        ).status,
      ).toBe(400);
    }
  });
});
