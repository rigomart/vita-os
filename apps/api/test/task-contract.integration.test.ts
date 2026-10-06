import type { ActivityLogPage, Thread } from "@vita-os/contracts";

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Session } from "./sessions";

import { createSession, succeed } from "./sessions";

async function createThread(session: Session): Promise<Thread> {
  return succeed<Thread>("/v1/threads", {
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

describe("Task HTTP contract", () => {
  it("adds, edits, focuses, completes and removes a Task", async () => {
    const owner = await createSession("tasks-routes");
    const created = await createThread(owner);
    const base = `/v1/threads/${created._id}`;

    let thread = await succeed<Thread>(`${base}/tasks`, {
      method: "POST",
      session: owner,
      body: { taskId: "a", text: "Call clinic", expectedRevision: 0 },
    });
    thread = await succeed<Thread>(`${base}/tasks`, {
      method: "POST",
      session: owner,
      body: {
        taskId: "b",
        text: "Book slot",
        expectedRevision: thread.revision,
      },
    });
    thread = await succeed<Thread>(`${base}/tasks/b`, {
      method: "PATCH",
      session: owner,
      body: { text: "Book a slot", expectedRevision: thread.revision },
    });
    thread = await succeed<Thread>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: "b", expectedRevision: thread.revision },
    });
    expect(thread.tasks).toEqual([
      { _id: "a", text: "Call clinic" },
      { _id: "b", text: "Book a slot" },
    ]);
    expect(thread.focusedTaskId).toBe("b");

    thread = await succeed<Thread>(`${base}/focus`, {
      method: "PUT",
      session: owner,
      body: { taskId: null, expectedRevision: thread.revision },
    });
    expect(thread).not.toHaveProperty("focusedTaskId");
    expect(thread).not.toHaveProperty("focusedMoveId");

    thread = await succeed<Thread>(`${base}/tasks/a/complete`, {
      method: "POST",
      session: owner,
      body: { expectedRevision: thread.revision },
    });
    expect(thread.tasks).toEqual([{ _id: "b", text: "Book a slot" }]);
    expect(await logOf(owner, thread)).toEqual([
      ["move_completed", 'Completed "Call clinic"'],
    ]);

    thread = await succeed<Thread>(`${base}/tasks/b`, {
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
