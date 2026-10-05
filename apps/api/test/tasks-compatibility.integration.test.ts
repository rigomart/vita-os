import type { ActivityLogPage, Thread } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { call, createSession, expectError, succeed } from "./sessions";

/**
 * ADR 0033 renamed Move to Task. For one release the API keeps the former
 * `/moves` routes and `moveId`, `moves` and `focusedMoveId` names beside the
 * new ones, so a browser that has not reloaded keeps working. Removing them is
 * issue #402. Storage keeps `moves_json` and `focused_move_id` throughout.
 */

type OldNames = Thread & {
  moves?: Array<{ _id: string; text: string }>;
  focusedMoveId?: string;
};

async function createThread(session: Session): Promise<OldNames> {
  return succeed<OldNames>("/v1/threads", {
    method: "POST",
    session,
    body: { title: "Book checkup" },
  });
}

async function logOf(session: Session, thread: Thread) {
  const page = await succeed<ActivityLogPage>(
    `/v1/threads/${thread._id}/activity`,
    { session },
  );
  return page.entries.map((entry) => [entry.type, entry.content]);
}

describe("new /tasks routes", () => {
  it("adds, edits, focuses, completes and removes a Task", async () => {
    const owner = await createSession("tasks-routes");
    const created = await createThread(owner);
    const base = `/v1/threads/${created._id}`;

    let thread = await succeed<OldNames>(`${base}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic", expectedRevision: 0 },
    });
    thread = await succeed<OldNames>(`${base}/tasks`, {
      method: "POST",
      session: owner,
      body: {
        taskId: "b",
        text: "Book slot",
        expectedRevision: thread.revision,
      },
    });
    thread = await succeed<OldNames>(`${base}/tasks/b`, {
      method: "PATCH",
      session: owner,
      body: { text: "Book a slot", expectedRevision: thread.revision },
    });
    thread = await succeed<OldNames>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "b", expectedRevision: thread.revision },
    });
    expect(thread.tasks).toEqual([
      { _id: "a", text: "Call clinic" },
      { _id: "b", text: "Book a slot" },
    ]);
    expect(thread.focusedTaskId).toBe("b");

    thread = await succeed<OldNames>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: null, expectedRevision: thread.revision },
    });
    expect(thread).not.toHaveProperty("focusedTaskId");
    expect(thread).not.toHaveProperty("focusedMoveId");

    thread = await succeed<OldNames>(`${base}/tasks/a/complete`, {
      method: "POST",
      session: owner,
      body: { expectedRevision: thread.revision },
    });
    expect(thread.tasks).toEqual([{ _id: "b", text: "Book a slot" }]);
    expect(await logOf(owner, thread)).toEqual([
      ["move_completed", 'Completed "Call clinic"'],
    ]);

    thread = await succeed<OldNames>(`${base}/tasks/b`, {
      method: "DELETE",
      session: owner,
      body: { expectedRevision: thread.revision },
    });
    expect(thread).not.toHaveProperty("tasks");
    expect(thread).not.toHaveProperty("moves");
  });

  it("stores Tasks in the unchanged columns", async () => {
    const owner = await createSession("tasks-routes-storage");
    const created = await createThread(owner);
    await succeed(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic", expectedRevision: 0 },
    });
    await succeed(`/v1/threads/${created._id}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "a", expectedRevision: 1 },
    });

    expect(
      await env.DB.prepare(
        "SELECT moves_json, focused_move_id FROM threads WHERE id = ?",
      )
        .bind(created._id)
        .first(),
    ).toEqual({
      moves_json: '[{"id":"a","text":"Call clinic"}]',
      focused_move_id: "a",
    });
  });
});

describe("former /moves routes", () => {
  it("still add, edit, focus, complete and remove a Task", async () => {
    const owner = await createSession("moves-routes");
    const created = await createThread(owner);
    const base = `/v1/threads/${created._id}`;

    let thread = await succeed<OldNames>(`${base}/moves`, {
      method: "POST",
      session: owner,
      body: { moveId: "a", text: "Call clinic", expectedRevision: 0 },
    });
    thread = await succeed<OldNames>(`${base}/moves`, {
      method: "POST",
      session: owner,
      body: {
        moveId: "b",
        text: "Book slot",
        expectedRevision: thread.revision,
      },
    });
    thread = await succeed<OldNames>(`${base}/moves/b`, {
      method: "PATCH",
      session: owner,
      body: { text: "Book a slot", expectedRevision: thread.revision },
    });
    thread = await succeed<OldNames>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { moveId: "a", expectedRevision: thread.revision },
    });
    expect(thread.tasks).toEqual([
      { _id: "a", text: "Call clinic" },
      { _id: "b", text: "Book a slot" },
    ]);
    expect(thread.focusedTaskId).toBe("a");

    thread = await succeed<OldNames>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { moveId: null, expectedRevision: thread.revision },
    });
    expect(thread).not.toHaveProperty("focusedTaskId");

    thread = await succeed<OldNames>(`${base}/moves/a/complete`, {
      method: "POST",
      session: owner,
      body: { expectedRevision: thread.revision },
    });
    expect(thread.tasks).toEqual([{ _id: "b", text: "Book a slot" }]);
    expect(await logOf(owner, thread)).toEqual([
      ["move_completed", 'Completed "Call clinic"'],
    ]);

    thread = await succeed<OldNames>(`${base}/moves/b`, {
      method: "DELETE",
      session: owner,
      body: { expectedRevision: thread.revision },
    });
    expect(thread).not.toHaveProperty("tasks");
  });

  it("accepts the new field name on the old route and the old one on the new route", async () => {
    const owner = await createSession("moves-routes-crossed");
    const created = await createThread(owner);

    let thread = await succeed<OldNames>(`/v1/threads/${created._id}/moves`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic", expectedRevision: 0 },
    });
    thread = await succeed<OldNames>(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { moveId: "b", text: "Book slot", expectedRevision: 1 },
    });
    expect(thread.tasks?.map((task) => task._id)).toEqual(["a", "b"]);
  });
});

describe("Thread responses carry both spellings", () => {
  it("returns equal tasks and moves, and equal focus fields", async () => {
    const owner = await createSession("tasks-both-names");
    const created = await createThread(owner);
    await succeed(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic", expectedRevision: 0 },
    });
    await succeed(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "b", text: "Book slot", expectedRevision: 1 },
    });
    const focused = await succeed<OldNames>(
      `/v1/threads/${created._id}/focus`,
      {
        method: "PUT",
        session: owner,
        body: { taskId: "b", expectedRevision: 2 },
      },
    );

    const open = (
      await succeed<OldNames[]>("/v1/threads", { session: owner })
    )[0];
    const detail = (
      await succeed<{ thread: OldNames }>(`/v1/threads/${created.slug}`, {
        session: owner,
      })
    ).thread;
    for (const thread of [focused, open, detail]) {
      expect(thread.tasks).toEqual([
        { _id: "a", text: "Call clinic" },
        { _id: "b", text: "Book slot" },
      ]);
      expect(thread.moves).toEqual(thread.tasks);
      expect(thread.focusedTaskId).toBe("b");
      expect(thread.focusedMoveId).toBe(thread.focusedTaskId);
    }
  });

  it("carries neither pair when the Thread has no Tasks", async () => {
    const owner = await createSession("tasks-both-names-empty");
    const created = await createThread(owner);
    for (const name of ["tasks", "moves", "focusedTaskId", "focusedMoveId"]) {
      expect(created).not.toHaveProperty(name);
    }
  });
});

describe("ambiguous or unknown spellings", () => {
  it("rejects a request naming both the old and the new ID field", async () => {
    const owner = await createSession("tasks-ambiguous");
    const created = await createThread(owner);
    const thread = await succeed<OldNames>(`/v1/threads/${created._id}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic", expectedRevision: 0 },
    });

    for (const [path, method, body] of [
      [
        "tasks",
        "POST",
        { taskId: "x", moveId: "x", text: "Both", expectedRevision: 1 },
      ],
      [
        "moves",
        "POST",
        { taskId: "x", moveId: "x", text: "Both", expectedRevision: 1 },
      ],
      ["focus", "PUT", { taskId: "a", moveId: "a", expectedRevision: 1 }],
      ["focus", "PUT", { taskId: null, moveId: null, expectedRevision: 1 }],
      // Neither name is just as unreadable.
      ["tasks", "POST", { text: "Neither", expectedRevision: 1 }],
      ["focus", "PUT", { expectedRevision: 1 }],
    ] as const) {
      expectError(
        await call(`/v1/threads/${created._id}/${path}`, {
          method,
          session: owner,
          body,
        }),
        { status: 400, code: "validation", message: "Invalid Task change." },
      );
    }

    const after = await succeed<OldNames>(`/v1/threads/${created._id}`, {
      method: "PATCH",
      session: owner,
      body: {},
    });
    expect(after.tasks).toEqual(thread.tasks);
    expect(after).not.toHaveProperty("focusedTaskId");
    expect(after.revision).toBe(thread.revision);
  });
});
